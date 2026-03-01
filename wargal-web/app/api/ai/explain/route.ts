import { NextResponse } from "next/server";

export const runtime = "nodejs"; // keep node runtime (stable for server fetch)

type Body = {
  title?: string;
  url?: string;
  text?: string;
  mode?: "summary" | "explain" | "bullet";
  language?: "so" | "en";
};

function clean(s?: string) {
  return (s ?? "").toString().trim().slice(0, 12000);
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

    const title = clean(body.title);
    const url = clean(body.url);
    const text = clean(body.text);

    if (!title && !text) {
      return NextResponse.json(
        { error: "Provide at least title or text." },
        { status: 400 }
      );
    }

    const mode = body.mode ?? "explain";
    const language = body.language ?? "so";

    const instruction =
      mode === "summary"
        ? "Summarize the article clearly."
        : mode === "bullet"
        ? "Summarize in concise bullet points."
        : "Explain the article in simple terms with context and why it matters.";

    const langRule =
      language === "so"
        ? "Write in Somali (Af-Soomaali), natural and clear."
        : "Write in English, clear and simple.";

    const userContent = [
      title ? `TITLE: ${title}` : "",
      url ? `URL: ${url}` : "",
      text ? `CONTENT: ${text}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    // No extra dependency required (uses fetch)
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content:
              "You are Wargal News AI assistant. Be factual, neutral, and avoid making up details. If the content is missing context, say what you can and what you cannot confirm.",
          },
          {
            role: "user",
            content: `${instruction}\n${langRule}\n\nReturn ONLY the answer, no preface.\n\n${userContent}`,
          },
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
    const answer = data?.choices?.[0]?.message?.content?.trim() ?? "";

    return NextResponse.json({ answer });
  } catch (e: any) {
    return NextResponse.json(
      { error: "Unexpected error", details: String(e?.message ?? e) },
      { status: 500 }
    );
  }
}