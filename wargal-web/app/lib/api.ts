import { NewsItem, NewsSource, normalizeFeedItem } from "@/app/types/news";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim() || "http://localhost:5194";

function unwrapList(json: any): any[] {
  if (Array.isArray(json)) return json;
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

function clean(s?: string | null) {
  return (s ?? "").trim();
}

export async function fetchFeedSources(): Promise<NewsSource[]> {
  const url = `${API_BASE}/feed-items/sources?_ts=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Sources failed (${res.status})`);
  const json = await res.json();
  const list = unwrapList(json);

  return list
    .filter(Boolean)
    .map((s: any) => ({
      id: String(s?.id ?? s?.Id ?? ""),
      name: String(s?.name ?? s?.sourceName ?? s?.SourceName ?? "Source"),
      iconUrl: s?.iconUrl ?? s?.sourceIconUrl ?? s?.SourceIconUrl ?? null,
      isActive: s?.isActive ?? s?.IsActive ?? true,
      trustLevel: s?.trustLevel ?? s?.TrustLevel ?? 0,
      category: s?.category ?? s?.Category ?? null,
      websiteUrl: s?.websiteUrl ?? s?.WebsiteUrl ?? null,
    }))
    .filter((s) => clean(s.id).length > 0);
}

export async function fetchFeedItems(params?: {
  page?: number;
  pageSize?: number;
  kind?: string;
  sourceId?: string;
  q?: string;
}): Promise<NewsItem[]> {
  const qs = new URLSearchParams();
  qs.set("page", String(params?.page ?? 1));
  qs.set("pageSize", String(params?.pageSize ?? 20));
  if (params?.kind) qs.set("kind", params.kind);
  if (params?.sourceId) qs.set("sourceId", String(params.sourceId));
  if (params?.q) qs.set("q", params.q);
  qs.set("_ts", String(Date.now())); // ✅ cache-buster

  const res = await fetch(`${API_BASE}/feed-items?${qs.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Feed failed (${res.status})`);

  const json = await res.json();
  const list = unwrapList(json);

  // ✅ normalize + remove any falsy
  return list.filter(Boolean).map(normalizeFeedItem).filter(Boolean);
}

export async function getFeedItems(): Promise<NewsItem[]> {
  return fetchFeedItems({ page: 1, pageSize: 60 });
}

export async function getFeedSources(): Promise<NewsSource[]> {
  return fetchFeedSources();
}
