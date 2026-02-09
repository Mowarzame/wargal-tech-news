import { NewsItem, NewsSource, normalizeFeedItem } from "@/app/types/news";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim() || "http://localhost:5194";

function unwrapList(json: any): any[] {
  // Supports:
  // 1) ServiceResponse: { data: [...] }
  // 2) raw array: [...]
  // 3) anything else => []
  if (Array.isArray(json)) return json;
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

export async function fetchFeedSources(): Promise<NewsSource[]> {
  const res = await fetch(`${API_BASE}/feed-items/sources`, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sources failed (${res.status})`);
  const json = await res.json();
  const list = (json.data ?? []) as any[];

  return list.map((s) => ({
    id: String(s.id),
    name: String(s.name ?? s.sourceName ?? "Source"),
    iconUrl: s.iconUrl ?? s.sourceIconUrl ?? null,
    isActive: s.isActive ?? true,
    trustLevel: s.trustLevel ?? 0,
    category: s.category ?? null, // ✅ add
  }));
}

export async function fetchFeedItems(params?: {
  page?: number;
  pageSize?: number;
  kind?: string; // "Article" | "Video" (optional) — passed through as-is
  sourceId?: string;
  q?: string;
}): Promise<NewsItem[]> {
  const qs = new URLSearchParams();
  qs.set("page", String(params?.page ?? 1));
  qs.set("pageSize", String(params?.pageSize ?? 20));
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.sourceId) qs.set("sourceId", params.sourceId);
  if (params?.q) qs.set("q", params.q);

  const res = await fetch(`${API_BASE}/feed-items?${qs.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Feed failed (${res.status})`);

  const json = await res.json();
  const list = unwrapList(json);

  // ✅ Centralized normalization (linkUrl -> url etc)
  return list.map(normalizeFeedItem);
}

/**
 * Server-component friendly homepage wrappers (as requested)
 * These do NOT change behavior; they just provide stable defaults.
 */
export async function getFeedItems(): Promise<NewsItem[]> {
  return fetchFeedItems({ page: 1, pageSize: 60 });
}

export async function getFeedSources(): Promise<NewsSource[]> {
  return fetchFeedSources();
}
