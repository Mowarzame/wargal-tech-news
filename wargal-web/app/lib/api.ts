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

// ✅ Same idea as Flutter _authHeaderOnly()
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
  page?: number;          // starting page (default 1)
  pageSize?: number;      // requested target count for frontend (we still page at 50)
  kind?: string;
  sourceId?: string;
  q?: string;
  diverse?: boolean;

  // ✅ NEW: frontend-only window
  sinceDays?: number;     // default 3
  maxPages?: number;      // safety cap (default 12)
}): Promise<NewsItem[]> {
  const startPage = Math.max(1, Number(params?.page ?? 1));
  const targetCount = Math.max(1, Number(params?.pageSize ?? 60));

  // ✅ Backend enforces pageSize <= 50, so we page at 50 always
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

    // cache-buster (safe)
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

    // ✅ Keep only within sinceDays (frontend window)
    const windowed = normalized.filter((x) => isWithinDays((x as any)?.publishedAt, sinceDays));

    // Add windowed items
    for (const it of windowed) add(it);

    // ✅ Stop conditions:
    // 1) we already got enough items for UI
    if (out.length >= targetCount) break;

    // 2) if the OLDEST item in this page is older than sinceDays, next pages will be older → stop
    const last = normalized[normalized.length - 1];
    if (last && !isWithinDays((last as any)?.publishedAt, sinceDays)) break;

    // 3) else keep paging
    page++;
  }

  // Ensure newest first (backend is already desc, but after filtering/dedupe we re-sort)
  out.sort((a: any, b: any) => clean(b?.publishedAt).localeCompare(clean(a?.publishedAt)));

  return out;
}

export async function getFeedItems(): Promise<NewsItem[]> {
  // ✅ Default: last 3 days, enough items for homepage
  return fetchFeedItems({ page: 1, pageSize: 200, sinceDays: 3, maxPages: 12 });
}

export async function getFeedSources(): Promise<NewsSource[]> {
  return fetchFeedSources();
}

/* =========================
   AUTH (GOOGLE -> API JWT)
========================= */
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

function unwrapOne<T>(json: any): T | null {
  if (!json) return null;
  if (json?.data && typeof json.data === "object") return json.data as T;
  return json as T;
}

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
export type PostDto = {
  id: string;
  title: string;
  content?: string | null;
  imageUrl?: string | null;
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
  imageFile?: File | null;
}): Promise<PostDto> {
  const uri = `${API_BASE}/posts/with-image`;

  const form = new FormData();
  form.append("Title", args.title);
  form.append("Content", args.content);

  const v = clean(args.videoUrl ?? "");
  if (v) form.append("VideoUrl", v);

  if (args.imageFile) {
    form.append("Image", args.imageFile, args.imageFile.name);
  }

  const res = await fetch(uri, {
    method: "POST",
    headers: { ...authHeaderOnly() }, // ✅ DO NOT set Content-Type manually
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