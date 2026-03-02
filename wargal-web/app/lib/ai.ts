type SomaliSummaryInput = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null;
  sourceName?: string | null;

  // ✅ NEW: pass category so we can enforce transcript-only for ForeignNews videos
  category?: string | null;
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
  if (!r.ok) return "";

  const j = await r.json().catch(() => ({ transcript: "" }));
  return clean(j?.transcript);
}

export async function summarizeSomali(input: SomaliSummaryInput) {
  const url = safeUrl(input.url);
  const category = clean(input.category);

  let longText = clean(input.summary);

  // ✅ STRICT: ForeignNews videos MUST use transcript
  const isForeignNewsVideo = input.kind === 2 && category === "ForeignNews";

  if (isForeignNewsVideo && url) {
    const transcript = await getYoutubeTranscript(url);

    // ✅ required
    if (!transcript) {
      throw new Error("No YouTube captions/transcript available for this ForeignNews video.");
    }

    longText = transcript;
  } else if (input.kind === 2 && url) {
    // ✅ Non-ForeignNews videos: keep your previous behavior (optional transcript)
    const transcript = await getYoutubeTranscript(url);
    if (transcript) longText = transcript;
  }

  const payload = {
    ...input,
    url,
    summary: longText,
    category: category || null,
  };

  const res = await fetch("/api/ai/somali-summary", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error ?? "AI failed");

  return data;
}