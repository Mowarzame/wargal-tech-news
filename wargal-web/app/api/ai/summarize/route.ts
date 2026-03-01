import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  kind: 1 | 2; // 1=Website RSS, 2=YouTube
  title: string;
  url: string;
  summary?: string | null; // RSS summary/description if available
  sourceName?: string | null;
};

function clean(s?: string | null, max = 12000) {
  return (s ?? "").toString().trim().slice(0, max);
}

// super-light HTML -> text (good enough for now)
function htmlToText(html: string) {
  // remove scripts/styles
  let t = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // strip tags
  t = t.replace(/<\/?[^>]+(>|$)/g, " ");
  // decode common entities roughly
  t = t
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
  // collapse whitespace
  t = t.replace(/\s+/g, " ").trim();
  return t;
}

async function fetchArticleText(url: string) {
  const r = await fetch(url, {
    // looks like a normal browser to avoid some blocks
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; WargalNewsBot/1.0; +https://www.wargalnews.com)",
      "Accept-Language": "so,en;q=0.9",
    },
    // avoid hanging forever
    cache: "no-store",
  });

  if (!r.ok) throw new Error(`Failed to fetch article: ${r.status}`);
  const html = await r.text();
  const text = htmlToText(html);
  return text.slice(0, 12000); // keep it reasonable
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "OPENAI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
    const body = (await req.json()) as Body;

    const kind = body.kind;
    const title = clean(body.title, 500);
    const url = clean(body.url, 2000);
    const rssSummary = clean(body.summary, 4000);
    const sourceName = clean(body.sourceName, 200);

    if (!title || !url || !kind) {
      return NextResponse.json(
        { error: "Missing required fields: kind, title, url" },
        { status: 400 }
      );
    }

    let contentText = "";

    if (kind === 1) {
      // Website RSS: try to fetch real page text (best summaries)
      try {
        contentText = await fetchArticleText(url);
      } catch {
        // fallback to RSS summary if fetch fails
        contentText = rssSummary;
      }
    } else {
      // YouTube RSS: we usually only have description/summary
      contentText = rssSummary;
    }

    // If still no text, summarize from title only (weak but works)
    const inputBlock = [
      sourceName ? `SOURCE: ${sourceName}` : "",
      `TITLE: ${title}`,
      `URL: ${url}`,
      contentText ? `CONTENT: ${contentText}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const prompt = `
Soo saar SOO KOOBID (Af-Soomaali) oo kooban, cad, dhexdhexaad ah.

Shuruudo:
- 2 ilaa 4 sadar (ama 3-6 qodob haddii aad doorato bullets)
- Ha sameyn wax mala-awaal ah; haddii xogtu yar tahay sheeg "faahfaahin kooban ayaa la helay".
- Haddii ay tahay YouTube oo aan transcript jirin: ku saleyso title + description.
- Ku dar hal sadar "Muhiimadda:" (why it matters) oo kooban.

Return ONLY the Somali summary.
`.trim();

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content:
              "You are Wargal News summarizer. Be factual, neutral, concise. No hallucinations.",
          },
          { role: "user", content: `${prompt}\n\n${inputBlock}` },
        ],
      }),
    });

    if (!r.ok) {
      const errText = await r.text();
      return NextResponse.json(
        { error: "OpenAI request failed", details: errText },
        { status: 500 }
      );
    }

    const data = await r.json();
    const summary = data?.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ summary });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}