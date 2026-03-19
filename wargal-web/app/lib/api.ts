import { NewsItem, NewsSource, normalizeFeedItem } from "@/app/types/news";
import { authHeaders } from "@/app/lib/auth";

const API_BASE =
  (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim() || "http://localhost:5194";

function unwrapList(json: any): any[] {
  if (Array.isArray(json)) return json;
  const data = json?.data;
  return Array.isArray(data) ? data : [];
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem("wargal_token");
  } catch {
    return null;
  }
}

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function authHeaderOnly(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseDate(input: any): Date | null {
  const s = clean(String(input ?? ""));
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function isWithinDays(publishedAt: any, days: number): boolean {
  const d = parseDate(publishedAt);
  if (!d) return false;
  const ms = days * 24 * 60 * 60 * 1000;
  return Date.now() - d.getTime() <= ms;
}

export type PostReactionUserDto = {
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  isLike: boolean;
  createdAt: string;
};

export type UserLoginDto = {
  name: string;
  email: string;
  profilePictureUrl?: string | null;
};

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string | null;
  role: string;
};

export type LoginResponse = {
  token: string;
  user: AuthUser;
};

export type PostDto = {
  id: string;
  title: string;
  content?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  allImages?: string[] | null;
  videoUrl?: string | null;
  user: AuthUser;
  createdAt: string;
  isVerified: boolean;
  likes: number;
  dislikes: number;
  myReaction?: boolean | null;
  commentsCount: number;
};

export type CommentDto = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  content: string;
  createdAt: string;
};

function unwrapOne<T>(json: any): T | null {
  if (!json) return null;
  if (json?.data && typeof json.data === "object") return json.data as T;
  return json as T;
}

export function getPostImages(post?: {
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  allImages?: string[] | null;
} | null): string[] {
  const raw = [
    ...(Array.isArray(post?.allImages) ? post!.allImages! : []),
    ...(Array.isArray(post?.imageUrls) ? post!.imageUrls! : []),
    clean(post?.imageUrl),
  ];

  const out: string[] = [];
  const seen = new Set<string>();

  for (const v of raw) {
    const x = clean(v);
    if (!x || seen.has(x)) continue;
    seen.add(x);
    out.push(x);
  }

  return out;
}

/* =========================
   FEED (PUBLIC)
========================= */
export async function fetchFeedSources(): Promise<NewsSource[]> {
  const url = `${API_BASE}/feed-items/sources?_ts=${Date.now()}`;
  const res = await fetch(url, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
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
  diverse?: boolean;
  sinceDays?: number;
  maxPages?: number;
}): Promise<NewsItem[]> {
  const startPage = Math.max(1, Number(params?.page ?? 1));
  const targetCount = Math.max(1, Number(params?.pageSize ?? 60));
  const backendPageSize = 50;
  const sinceDays = Math.max(1, Number(params?.sinceDays ?? 3));
  const maxPages = Math.max(1, Math.min(40, Number(params?.maxPages ?? 12)));

  const out: NewsItem[] = [];
  const seen = new Set<string>();

  const add = (it: NewsItem) => {
    const k = clean((it as any)?.id) || clean((it as any)?.url);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(it);
  };

  let page = startPage;

  for (let i = 0; i < maxPages; i++) {
    const qs = new URLSearchParams();
    qs.set("page", String(page));
    qs.set("pageSize", String(backendPageSize));

    if (params?.kind) qs.set("kind", String(params.kind));
    if (params?.sourceId) qs.set("sourceId", String(params.sourceId));
    if (params?.q) qs.set("q", String(params.q));
    if (params?.diverse) qs.set("diverse", "true");
    qs.set("_ts", String(Date.now()));

    const url = `${API_BASE}/feed-items?${qs.toString()}`;
    const res = await fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Feed failed (${res.status}): ${txt}`);
    }

    const json = await res.json().catch(() => null);
    const rawList = unwrapList(json);

    if (!rawList.length) break;

    const normalized = rawList.filter(Boolean).map(normalizeFeedItem).filter(Boolean);
    const windowed = normalized.filter((x) => isWithinDays((x as any)?.publishedAt, sinceDays));

    for (const it of windowed) add(it);

    if (out.length >= targetCount) break;

    const last = normalized[normalized.length - 1];
    if (last && !isWithinDays((last as any)?.publishedAt, sinceDays)) break;

    page++;
  }

  out.sort((a: any, b: any) => clean(b?.publishedAt).localeCompare(clean(a?.publishedAt)));
  return out;
}

export async function getFeedItems(): Promise<NewsItem[]> {
  return fetchFeedItems({ page: 1, pageSize: 200, sinceDays: 3, maxPages: 12 });
}

export async function getFeedSources(): Promise<NewsSource[]> {
  return fetchFeedSources();
}

/* =========================
   AUTH
========================= */
export async function loginGoogle(dto: UserLoginDto): Promise<LoginResponse> {
  const res = await fetch(`${API_BASE}/users/login-google`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`Login failed (${res.status})`);
  return (await res.json()) as LoginResponse;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${API_BASE}/users/me`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) return null;
  const json = await res.json();
  const user = unwrapOne<AuthUser>(json);
  return user ?? null;
}

/* =========================
   COMMUNITY (POSTS)
========================= */
export async function fetchPosts(): Promise<PostDto[]> {
  const res = await fetch(`${API_BASE}/posts`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Posts failed (${res.status})`);
  const json = await res.json();
  const list = (json?.data ?? json) as any[];
  return (Array.isArray(list) ? list : []).filter(Boolean) as PostDto[];
}

export async function createPost(dto: {
  title: string;
  content?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  userId: string;
}): Promise<PostDto> {
  const res = await fetch(`${API_BASE}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(dto),
  });
  if (!res.ok) throw new Error(`Create post failed (${res.status})`);
  const json = await res.json();
  return (json?.data ?? json) as PostDto;
}

export async function fetchPostReactionsUsers(postId: string): Promise<PostReactionUserDto[]> {
  const res = await fetch(`${API_BASE}/posts/${postId}/reactions/users?_ts=${Date.now()}`, {
    cache: "no-store",
    headers: { ...authHeaderOnly() },
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const msg = json?.message ?? `Failed to load reaction users (${res.status}): ${text}`;
    throw new Error(msg);
  }

  const list = (json?.data ?? json) as any[];
  return (Array.isArray(list) ? list : []).filter(Boolean) as PostReactionUserDto[];
}

export async function createPostWithImage(args: {
  title: string;
  content: string;
  videoUrl?: string | null;
  imageFiles?: File[] | null;
}): Promise<PostDto> {
  const uri = `${API_BASE}/posts/with-image`;

  const form = new FormData();
  form.append("Title", args.title);
  form.append("Content", args.content);

  const v = clean(args.videoUrl ?? "");
  if (v) form.append("VideoUrl", v);

  for (const file of args.imageFiles ?? []) {
    form.append("Images", file, file.name);
  }

  const res = await fetch(uri, {
    method: "POST",
    headers: { ...authHeaderOnly() },
    body: form,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {}

  if (!res.ok) {
    const msg = json?.message ?? `Failed to create post (${res.status}): ${text}`;
    throw new Error(msg);
  }

  return (json?.data ?? json) as PostDto;
}
export async function reactToPost(
  postId: string,
  isLike: boolean | null
): Promise<{ likes: number; dislikes: number; myReaction: boolean | null }> {
  const res = await fetch(`${API_BASE}/posts/${postId}/reactions`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ isLike }),
  });
  if (!res.ok) throw new Error(`React failed (${res.status})`);
  const json = await res.json();
  return (json?.data ?? json) as any;
}

export async function fetchComments(postId: string): Promise<CommentDto[]> {
  const res = await fetch(`${API_BASE}/posts/${postId}/comments?_ts=${Date.now()}`, {
    cache: "no-store",
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error(`Comments failed (${res.status})`);
  const json = await res.json();
  const list = (json?.data ?? json) as any[];
  return (Array.isArray(list) ? list : []).filter(Boolean) as CommentDto[];
}

export async function addComment(postId: string, content: string): Promise<CommentDto> {
  const res = await fetch(`${API_BASE}/posts/${postId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ content }),
  });
  if (!res.ok) throw new Error(`Add comment failed (${res.status})`);
  const json = await res.json();
  return (json?.data ?? json) as CommentDto;
}