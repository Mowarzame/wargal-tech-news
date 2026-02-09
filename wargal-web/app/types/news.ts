export type NewsKind = 1 | 2; // 1=Article, 2=Video

export type NewsItem = {
  id: string;
  sourceId: string;
  sourceName: string;
  sourceIconUrl?: string | null;
  kind: NewsKind;
  title: string;
  summary?: string | null;
  url: string;              // ✅ normalized from linkUrl
  imageUrl?: string | null;
  publishedAt: string;      // ✅ keep as string (avoid Date hydration issues)
  youTubeVideoId?: string | null;
  embedUrl?: string | null;
};

export type NewsSource = {
  id: string;
  name: string;
  iconUrl?: string | null;
  category?: string | null; // ✅ ADD THIS
   websiteUrl?: string | null;
  isActive?: boolean;
  trustLevel?: number;
  
};


export function normalizeFeedItem(x: any): NewsItem {
  return {
    id: String(x.id),
    sourceId: String(x.sourceId ?? ""),
    sourceName: String(x.sourceName ?? "Source"),
    sourceIconUrl: x.sourceIconUrl ?? null,
    kind: (x.kind === 2 ? 2 : 1),
    title: String(x.title ?? ""),
    summary: x.summary ?? null,
    url: String(x.linkUrl ?? x.url ?? ""), // ✅ linkUrl -> url
    imageUrl: x.imageUrl ?? null,
    publishedAt: String(x.publishedAt ?? ""),
    youTubeVideoId: x.youTubeVideoId ?? null,
    embedUrl: x.embedUrl ?? null,
  };
}
