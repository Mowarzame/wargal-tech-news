type SomaliSummaryInput = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null;
  sourceName?: string | null;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function safeUrl(u?: string | null) {
  const x = clean(u);
  return x.startsWith("http://") || x.startsWith("https://") ? x : "";
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }

    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];

      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

async function getYoutubeTranscript(url: string) {
  const id = extractYoutubeId(url);
  if (!id) return "";

  const r = await fetch(`/api/youtube/transcript?videoId=${encodeURIComponent(id)}`);
  const j = await r.json().catch(() => ({ transcript: "" }));
  return clean(j?.transcript);
}

export async function summarizeSomali(input: SomaliSummaryInput) {
  const url = safeUrl(input.url);

  let longText = clean(input.summary);

  // ✅ For videos: try transcript first
  if (input.kind === 2 && url) {
    const transcript = await getYoutubeTranscript(url);
    if (transcript) longText = transcript;
  }

  // fallback: keep description/summary if transcript is missing
  const payload = {
    ...input,
    url,
    summary: longText,
  };

  const res = await fetch("/api/ai/somali-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "AI failed");

  return data;
}