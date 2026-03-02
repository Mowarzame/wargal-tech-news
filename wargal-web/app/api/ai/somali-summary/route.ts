import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type Body = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null;      // RSS description OR YouTube transcript (for ForeignNews videos)
  sourceName?: string | null;

  // ✅ NEW: used to enforce transcript-only for ForeignNews videos
  category?: string | null;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const kind: 1 | 2 = body.kind === 2 ? 2 : 1;
    const title = clean(body.title);
    const url = clean(body.url);
    const summary = clean(body.summary);
    const sourceName = clean(body.sourceName);
    const category = clean(body.category);

    if (!title || !url) {
      return NextResponse.json({ error: "Missing title or url" }, { status: 400 });
    }

    // ✅ STRICT RULE:
    // ForeignNews videos MUST use YouTube captions/transcript (sent in `summary`)
    if (kind === 2 && category === "ForeignNews" && !summary) {
      return NextResponse.json(
        { error: "ForeignNews videos require YouTube captions/transcript." },
        { status: 400 }
      );
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const client = new OpenAI({ apiKey });

    // ✅ Keep your prompt as-is (only tiny enhancement: include category + rename Description -> Content)
    const input = `
You are a highly intelligent Somali investigative journalist and analyst.

Your task:
Write a deeply informative, intelligent, and well-structured Somali summary of the news below.

STRICT RULES:
- The summary MUST be written in fluent, natural Somali.
- Use professional journalistic tone.
- Minimum THREE well-developed paragraphs.
- Do NOT repeat words unnecessarily.
- Do NOT repeat sentence structures.
- Do NOT include filler.
- Do NOT mention that information is missing.
- Do NOT apologize.
- Do NOT say "macluumaad dheeraad ah ma jiro".
- Do NOT say that details are unavailable.
- Do NOT say "lama oga".
- Do NOT speculate beyond logical reasoning.
- Be analytical and contextual.
- If it is political, explain background and implications.
- If it is economic, explain impact.
- If it is social, explain consequences.
- Make it rich, informative, and intelligent.

You may use logical reasoning and contextual knowledge to enrich the explanation.

News Data:
Title: ${title}
Source: ${sourceName}
Category: ${category}
URL: ${url}
Content: ${summary}

Now produce the summary.
`.trim();

    const resp = await client.responses.create({
      model,
      input,
      temperature: 0.3,
    });

    const text = (resp.output_text || "").trim();

    return NextResponse.json({ summary: text || "Ma helin soo koobid (AI)." });
  } catch (e: any) {
    return NextResponse.json(
      {
        error: "OpenAI request failed",
        details: e?.message ?? String(e),
      },
      { status: 500 }
    );
  }
}