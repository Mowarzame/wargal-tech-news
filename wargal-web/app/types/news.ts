export type NewsKind = 1 | 2; // 1=Article, 2=Video

export type NewsItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceIconUrl?: string | null;
  kind: NewsKind;
  title: string;
  summary?: string | null;
  url: string;              // normalized from linkUrl
  imageUrl?: string | null;
  publishedAt: string;      // keep as string
  youTubeVideoId?: string | null;
  embedUrl?: string | null;
};

export type NewsSource = {
  id: string;
  name: string;
  iconUrl?: string | null;
  category?: string | null;
  websiteUrl?: string | null;
  isActive?: boolean;
  trustLevel?: number;
};

function s(x: any, fallback = "") {
  const v = (x ?? "").toString();
  return v;
}

function clean(x: any) {
  return s(x).trim();
}

/**
 * ✅ Never returns undefined fields that can crash UI.
 * ✅ Ensures every NewsItem has: id, title, url, sourceName, publishedAt as strings (possibly empty but safe).
 */
export function normalizeFeedItem(x: any): NewsItem {
  const id = clean(x?.id) || clean(x?.Id) || cryptoSafeId();
  const sourceId = clean(x?.sourceId ?? x?.SourceId) || "";
  const sourceName = clean(x?.sourceName ?? x?.SourceName) || "Source";

  const linkUrl = clean(x?.linkUrl ?? x?.LinkUrl ?? x?.url ?? x?.Url);
  const publishedAt = clean(x?.publishedAt ?? x?.PublishedAt) || "";

  return {
    id,
    sourceId,
    sourceName,
    sourceIconUrl: x?.sourceIconUrl ?? x?.SourceIconUrl ?? null,
    kind: (x?.kind === 2 || x?.Kind === 2 ? 2 : 1),
    title: clean(x?.title ?? x?.Title) || "(Untitled)",
    summary: x?.summary ?? x?.Summary ?? null,
    url: linkUrl, // can be empty; UI must guard before opening
    imageUrl: x?.imageUrl ?? x?.ImageUrl ?? null,
    publishedAt,
    youTubeVideoId: x?.youTubeVideoId ?? x?.YouTubeVideoId ?? null,
    embedUrl: x?.embedUrl ?? x?.EmbedUrl ?? null,
  };
}

function cryptoSafeId() {
  try {
    // browser
    // @ts-ignore
    if (typeof crypto !== "undefined" && crypto?.randomUUID) return crypto.randomUUID();
  } catch {}
  return `tmp_${Math.random().toString(16).slice(2)}_${Date.now()}`;
}
