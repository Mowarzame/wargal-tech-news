// wargal-web/app/api/summarize/route.ts
import { NextResponse } from "next/server";
import Groq from "groq-sdk";

export const runtime = "nodejs"; // ✅ Groq SDK works reliably on node runtime (not edge)

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

type SummarizeBody = {
  title?: string;
  sourceName?: string;
  url?: string;
  kind?: number; // 2 = YouTube in your system
  content?: string; // optional: if you already have extracted text/transcript
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

export async function POST(req: Request) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "Missing GROQ_API_KEY" },
        { status: 500 }
      );
    }

    const body = (await req.json()) as SummarizeBody;

    const title = clean(body.title);
    const sourceName = clean(body.sourceName);
    const url = clean(body.url);
    const kind = Number(body.kind ?? 0);
    const content = clean(body.content);

    // ✅ We can summarize using title + url + optional content
    // (If you later add server-side article text extraction, pass it in `content`)
    const inputBlock = [
      title ? `Title: ${title}` : "",
      sourceName ? `Source: ${sourceName}` : "",
      url ? `URL: ${url}` : "",
      `Type: ${kind === 2 ? "YouTube" : "Website RSS"}`,
      content ? `Content:\n${content}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // ✅ Somali summarizer prompt (works for both YouTube + articles)
    const system = `
You are a Somali news summarizer for "Wargal News".
Rules:
- Output in Somali only.
- Be factual. Do not invent details.
- If info is missing, say "Faahfaahin dheeraad ah lama helin" briefly.
- Keep it readable for Somali audiences.
Format:
1) Hal-kalmad cinwaan gaaban (<= 12 words)
2) 4-7 dhibcood (bullet points) oo kooban
3) "Maxay ka dhigan tahay?" 1-2 sadar (why it matters)
4) "Xigasho:" ku qor source + link haddii la bixiyay
`;

    const user = `
Summarize this news item in Somali following the format exactly:

${inputBlock}
`;

    // ✅ Pick a strong Groq-hosted model
    // Common good default: "llama-3.1-8b-instant" (fast) or "llama-3.1-70b-versatile" (higher quality if available)
    const model = "llama-3.1-8b-instant";

    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 450,
      messages: [
        { role: "system", content: system.trim() },
        { role: "user", content: user.trim() },
      ],
    });

    const summary = completion.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ summary, model });
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Groq request failed",
        details: String(err?.message ?? err),
      },
      { status: 500 }
    );
  }
}