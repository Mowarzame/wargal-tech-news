// app/api/ai/somali-summary/route.ts
import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type Body = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null; // transcript OR description (hybrid)
  sourceName?: string | null;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

// ✅ Simple warm-instance cache (big speed win for repeats)
const CACHE_TTL_MS = 1000 * 60 * 60 * 12; // 12 hours
const cache = new Map<string, { ts: number; summary: string }>();

function cacheKey(kind: number, title: string, url: string, content: string, sourceName: string) {
  // deterministic + stable (no prompt changes needed)
  return `${kind}::${url}::${title}::${sourceName}::len:${content.length}`;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Body;

    const kind = body.kind === 2 ? 2 : 1;
    const title = clean(body.title);
    const url = clean(body.url);
    const content = clean(body.summary);
    const sourceName = clean(body.sourceName);

    if (!title || !url) {
      return NextResponse.json({ error: "Missing title or url" }, { status: 400 });
    }

    // ✅ Cache hit
    const key = cacheKey(kind, title, url, content || title, sourceName);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
      return NextResponse.json({ summary: hit.summary, cached: true });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "OPENAI_API_KEY is not configured" }, { status: 500 });
    }

    const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
    const client = new OpenAI({ apiKey });

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

News Data:
Type: ${kind === 2 ? "YouTube Video" : "Article/RSS"}
Title: ${title}
Source: ${sourceName}
URL: ${url}
Content: ${content || title}

Now produce the Somali summary.
`.trim();

    const resp = await client.responses.create({
      model,
      input,
      temperature: 0.3,
    });

    const text = (resp.output_text || "").trim();
    const finalText = text || "Ma helin soo koobid (AI).";

    // ✅ store cache
    cache.set(key, { ts: Date.now(), summary: finalText });

    return NextResponse.json({ summary: finalText });
  } catch (e: any) {
    return NextResponse.json(
      { error: "OpenAI request failed", details: e?.message ?? String(e) },
      { status: 500 }
    );
  }
}