import { NextResponse } from "next/server";

export const runtime = "nodejs";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

// Very small XML stripper for timedtext responses
function stripXml(xml: string) {
  // <text start="..." dur="...">Hello &amp; world</text>
  // Decode basic entities and remove tags
  const withoutTags = xml
    .replace(/<text[^>]*>/g, "")
    .replace(/<\/text>/g, "\n")
    .replace(/<[^>]+>/g, " ");
  return withoutTags
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

async function fetchTranscriptFromTimedText(videoId: string) {
  // Try common timedtext endpoint (works only if captions exist & are accessible)
  const url = `https://www.youtube.com/api/timedtext?lang=en&v=${encodeURIComponent(videoId)}`;
  const r = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    },
  });

  if (!r.ok) return "";
  const xml = await r.text();
  const text = stripXml(xml);
  return clean(text);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const videoId = clean(searchParams.get("videoId"));

    if (!videoId) {
      return NextResponse.json({ transcript: "" }, { status: 200 });
    }

    // 1) Try timedtext
    const transcript = await fetchTranscriptFromTimedText(videoId);

    return NextResponse.json({ transcript }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { transcript: "", error: e?.message ?? "Failed to fetch transcript" },
      { status: 200 }
    );
  }
}