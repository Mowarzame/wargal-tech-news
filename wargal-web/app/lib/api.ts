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
  qs.set("_ts", String(Date.now())); // cache-buster

  const res = await fetch(`${API_BASE}/feed-items?${qs.toString()}`, {
    cache: "no-store",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`Feed failed (${res.status})`);

  const json = await res.json();
  const list = unwrapList(json);

  return list.filter(Boolean).map(normalizeFeedItem).filter(Boolean);
}

export async function getFeedItems(): Promise<NewsItem[]> {
  return fetchFeedItems({ page: 1, pageSize: 60 });
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
  // users/me returns ServiceResponse<UserDto>
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

// ✅ ADD inside wargal-web/app/lib/api.ts (near createPost)

// ✅ Same behavior as Flutter createPostWithImage
export async function createPostWithImage(args: {
  title: string;
  content: string;
  videoUrl?: string | null;
  imageFile?: File | null;
}): Promise<PostDto> {
  const uri = `${API_BASE}/posts/with-image`;

  const form = new FormData();

  // ✅ must match backend DTO property names exactly
  form.append("Title", args.title);
  form.append("Content", args.content);

  const v = clean(args.videoUrl ?? "");
  if (v) form.append("VideoUrl", v);

  // ✅ File field name must match backend: "Image"
  if (args.imageFile) {
    // browser automatically provides filename, but we pass it explicitly for consistency
    form.append("Image", args.imageFile, args.imageFile.name);
  }

  const res = await fetch(uri, {
    method: "POST",
    headers: {
      ...authHeaderOnly(), // ✅ DO NOT set Content-Type manually
    },
    body: form,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // ignore parse errors
  }

  if (!res.ok) {
    const msg = json?.message ?? `Failed to create post (${res.status}): ${text}`;
    throw new Error(msg);
  }

  const data = json?.data ?? json;
  return data as PostDto;
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