"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Divider,
  Avatar,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Stack,
  CircularProgress,
  Skeleton,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/app/providers/AuthProvider";
import TopSideBar from "@/app/components/news/TopSidebar";
import { fetchFeedItems } from "@/app/lib/api";
import TimeAgo from "@/app/components/common/TimeAgo";

type UserDto = {
  id: string;
  name: string;
  email: string;
  profilePictureUrl?: string | null;
  role: string;
};

type PostDto = {
  id: string;
  title: string;
  content?: string | null;
  imageUrl?: string | null;
  videoUrl?: string | null;
  user: UserDto;
  createdAt: string;
  isVerified: boolean;
  likes: number;
  dislikes: number;
  myReaction?: boolean | null; // true/false/null
  commentsCount: number;
};

type CommentDto = {
  id: string;
  postId: string;
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  content: string;
  createdAt: string;
};

type ReactionUserDto = {
  userId: string;
  userName: string;
  userPhotoUrl?: string | null;
  isLike: boolean;
  createdAt: string;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function API_BASE() {
  return (process.env.NEXT_PUBLIC_API_BASE_URL || "").trim() || "http://localhost:5194";
}

async function readJson(res: Response) {
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const msg = json?.message || `Request failed (${res.status})`;
    throw new Error(msg);
  }
  return json;
}

function tokenFromStorage(): string | null {
  if (typeof window === "undefined") return null;
  const keys = ["token", "jwt", "auth_token", "wargal_token", "wargal.jwt"];
  for (const k of keys) {
    const v = window.localStorage.getItem(k);
    if (v && v.trim()) return v.trim();
  }
  return null;
}

function authHeaders(): HeadersInit {
  const t = tokenFromStorage();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ---------- YouTube helpers ----------
function extractYouTubeId(input?: string | null): string | null {
  const s = clean(input);
  if (!s) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const u = new URL(s);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.split("/").filter(Boolean)[0];
      return id && /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    const v = u.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    const parts = u.pathname.split("/").filter(Boolean);
    const shortsIdx = parts.findIndex((p) => p === "shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIdx + 1])) {
      return parts[shortsIdx + 1];
    }

    const embedIdx = parts.findIndex((p) => p === "embed");
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
      return parts[embedIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

function youtubeEmbedUrl(videoUrl?: string | null) {
  const id = extractYouTubeId(videoUrl);
  if (!id) return null;
  return `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;
}

// ---------- API calls ----------
async function getPost(postId: string): Promise<PostDto> {
  const res = await fetch(`${API_BASE()}/posts/${postId}`, {
    cache: "no-store",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const json = await readJson(res);
  return json?.data as PostDto;
}

async function getComments(postId: string): Promise<CommentDto[]> {
  const res = await fetch(`${API_BASE()}/posts/${postId}/comments`, {
    cache: "no-store",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const json = await readJson(res);
  return (json?.data ?? []) as CommentDto[];
}

async function addComment(postId: string, content: string): Promise<CommentDto> {
  const res = await fetch(`${API_BASE()}/posts/${postId}/comments`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ content }),
  });
  const json = await readJson(res);
  return json?.data as CommentDto;
}

async function deleteComment(commentId: string): Promise<void> {
  const res = await fetch(`${API_BASE()}/comments/${commentId}`, {
    method: "DELETE",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  await readJson(res);
}

async function reactToPost(
  postId: string,
  isLike: boolean | null
): Promise<{ likes: number; dislikes: number; myReaction: boolean | null }> {
  const res = await fetch(`${API_BASE()}/posts/${postId}/reactions`, {
    method: "PUT",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders(),
    },
    body: JSON.stringify({ isLike }),
  });
  const json = await readJson(res);
  return json?.data as any;
}

async function getReactionUsers(postId: string): Promise<ReactionUserDto[]> {
  const res = await fetch(`${API_BASE()}/posts/${postId}/reactions/users`, {
    cache: "no-store",
    headers: { Accept: "application/json", ...authHeaders() },
  });
  const json = await readJson(res);
  return (json?.data ?? []) as ReactionUserDto[];
}

// ---------- UI helpers ----------
function ReactionButton({
  active,
  label,
  icon,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Button
      onClick={onClick}
      startIcon={icon}
      sx={{
        textTransform: "none",
        fontWeight: 950,
        borderRadius: 999,
        bgcolor: active ? "primary.main" : "transparent",
        color: active ? "common.white" : "text.primary",
        "&:hover": { bgcolor: active ? "primary.dark" : "grey.100" },
      }}
    >
      {label}
    </Button>
  );
}

function isEditorOrAdmin(role?: string | null) {
  const r = clean(role).toLowerCase();
  return r === "admin" || r === "editor";
}

function PostDetailSkeleton() {
  return (
    <Box
      sx={{
        bgcolor: "common.white",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ p: 2 }}>
        <Skeleton variant="text" width={180} height={28} />
      </Box>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Stack direction="row" spacing={1.2} alignItems="center">
          <Skeleton variant="circular" width={40} height={40} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="42%" height={22} />
            <Skeleton variant="text" width="22%" height={18} />
          </Box>
          <Skeleton variant="rounded" width={74} height={26} />
        </Stack>

        <Skeleton variant="text" sx={{ mt: 2 }} width="70%" height={30} />
        <Skeleton variant="text" width="95%" height={22} />
        <Skeleton variant="text" width="92%" height={22} />
        <Skeleton variant="text" width="86%" height={22} />

        <Skeleton variant="rounded" sx={{ mt: 2 }} height={360} />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 2 }}>
          <Skeleton variant="rounded" width={160} height={34} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="text" width={110} height={20} />
        </Stack>

        <Divider sx={{ my: 1.25 }} />

        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
          <Skeleton variant="rounded" width={90} height={38} sx={{ borderRadius: 999 }} />
          <Skeleton variant="rounded" width={100} height={38} sx={{ borderRadius: 999 }} />
          <Skeleton variant="rounded" width={120} height={38} sx={{ borderRadius: 999 }} />
        </Stack>

        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" width={120} height={22} />
          <Skeleton variant="rounded" sx={{ mt: 1 }} height={44} />
          <Skeleton variant="rounded" sx={{ mt: 2 }} height={120} />
          <Skeleton variant="rounded" sx={{ mt: 1.5 }} height={120} />
        </Box>
      </Box>
    </Box>
  );
}

export default function PostDetailShell({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const { isReady, isAuthed, user } = useAuth();

  // Latest news (LEFT column)
  const latestQuery = useQuery({
    queryKey: ["communityPostLatestNews5"],
    queryFn: async () => {
      const items = await fetchFeedItems({ page: 1, pageSize: 20 });
      return (items ?? []).slice(0, 5);
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });

  const onOpenNews = (it: any) => {
    const url = clean(it?.url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // Post
  const postQuery = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPost(postId),
    staleTime: 10_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
  });

  // Comments (backend requires auth)
  const commentsQuery = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => getComments(postId),
    enabled: isReady && isAuthed,
    staleTime: 5_000,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  // Reaction users list dialog
  const [usersOpen, setUsersOpen] = useState(false);
  const usersQuery = useQuery({
    queryKey: ["reactionUsers", postId],
    queryFn: () => getReactionUsers(postId),
    enabled: isReady && isAuthed && usersOpen,
    staleTime: 5_000,
  });

  // Comment input
  const [commentText, setCommentText] = useState("");

  // Optimistic reactions
  const reactMutation = useMutation({
    mutationFn: (isLike: boolean | null) => reactToPost(postId, isLike),
    onMutate: async (nextReaction) => {
      await qc.cancelQueries({ queryKey: ["post", postId] });

      const prev = qc.getQueryData<PostDto>(["post", postId]);
      if (!prev) return { prev };

      const prevMy = prev.myReaction ?? null;
      let likes = prev.likes ?? 0;
      let dislikes = prev.dislikes ?? 0;

      if (prevMy === true) likes = Math.max(0, likes - 1);
      if (prevMy === false) dislikes = Math.max(0, dislikes - 1);

      if (nextReaction === true) likes += 1;
      if (nextReaction === false) dislikes += 1;

      qc.setQueryData<PostDto>(["post", postId], {
        ...prev,
        likes,
        dislikes,
        myReaction: nextReaction,
      });

      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["post", postId], ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["post", postId] });
      qc.invalidateQueries({ queryKey: ["reactionUsers", postId] });
    },
  });

  // Optimistic add comment
  const addCommentMutation = useMutation({
    mutationFn: (content: string) => addComment(postId, content),
    onMutate: async (content) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      await qc.cancelQueries({ queryKey: ["post", postId] });

      const prevComments = qc.getQueryData<CommentDto[]>(["comments", postId]) ?? [];
      const prevPost = qc.getQueryData<PostDto>(["post", postId]);

      const temp: CommentDto = {
        id: `temp-${Date.now()}`,
        postId,
        userId: clean(user?.id) || "me",
        userName: clean(user?.name) || "You",
        userPhotoUrl: clean(user?.profilePictureUrl) || null,
        content,
        createdAt: new Date().toISOString(),
      };

      qc.setQueryData<CommentDto[]>(["comments", postId], [temp, ...prevComments]);

      if (prevPost) {
        qc.setQueryData<PostDto>(["post", postId], {
          ...prevPost,
          commentsCount: (prevPost.commentsCount ?? 0) + 1,
        });
      }

      return { prevComments, prevPost };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevComments) qc.setQueryData(["comments", postId], ctx.prevComments);
      if (ctx?.prevPost) qc.setQueryData(["post", postId], ctx.prevPost);
    },
    onSuccess: (created) => {
      const cur = qc.getQueryData<CommentDto[]>(["comments", postId]) ?? [];
      const next = cur.map((c) => (c.id.startsWith("temp-") ? created : c));
      qc.setQueryData(["comments", postId], next);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  // Delete comment (optimistic)
  const deleteCommentMutation = useMutation({
    mutationFn: (commentId: string) => deleteComment(commentId),
    onMutate: async (commentId) => {
      await qc.cancelQueries({ queryKey: ["comments", postId] });
      await qc.cancelQueries({ queryKey: ["post", postId] });

      const prevComments = qc.getQueryData<CommentDto[]>(["comments", postId]) ?? [];
      const prevPost = qc.getQueryData<PostDto>(["post", postId]);

      qc.setQueryData<CommentDto[]>(
        ["comments", postId],
        prevComments.filter((c) => c.id !== commentId)
      );

      if (prevPost) {
        qc.setQueryData<PostDto>(["post", postId], {
          ...prevPost,
          commentsCount: Math.max(0, (prevPost.commentsCount ?? 0) - 1),
        });
      }

      return { prevComments, prevPost };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prevComments) qc.setQueryData(["comments", postId], ctx.prevComments);
      if (ctx?.prevPost) qc.setQueryData(["post", postId], ctx.prevPost);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  const post = postQuery.data;
  const canInteract = isReady && isAuthed;

  const myReaction = post?.myReaction ?? null;
  const likes = post?.likes ?? 0;
  const dislikes = post?.dislikes ?? 0;

  const onLike = () => {
    if (!canInteract) return;
    reactMutation.mutate(myReaction === true ? null : true);
  };

  const onDislike = () => {
    if (!canInteract) return;
    reactMutation.mutate(myReaction === false ? null : false);
  };

  const submitComment = () => {
    if (!canInteract) return;
    const txt = clean(commentText);
    if (!txt) return;
    setCommentText("");
    addCommentMutation.mutate(txt);
  };

  const latestItems = latestQuery.data ?? [];
  const embed = youtubeEmbedUrl(post?.videoUrl);

  const canDeleteComment = (c: CommentDto) => {
    if (!canInteract) return false;
    const me = clean(user?.id);
    if (me && clean(c.userId) === me) return true;
    // optional: allow admins/editors to delete
    if (isEditorOrAdmin(user?.role)) return true;
    return false;
  };

  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
        <Box sx={{ maxWidth: 1280, mx: "auto" }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              alignItems: "start",
              gridTemplateColumns: {
                xs: "1fr",
                md: "1fr",
                lg: "320px minmax(0,1fr) 320px",
              },
            }}
          >
            {/* LEFT (desktop): Latest */}
            <Box sx={{ display: { xs: "none", lg: "block" }, position: "sticky", top: 86 }}>
              {latestQuery.isLoading ? (
                <Skeleton variant="rounded" height={560} />
              ) : (
                <TopSideBar title="Latest" items={latestItems as any} onOpen={onOpenNews} />
              )}
            </Box>

            {/* CENTER */}
            <Box sx={{ minWidth: 0 }}>
              {/* ✅ Important: local skeleton so it also appears on back/forward cached navigations */}
              {postQuery.isLoading ? (
                <PostDetailSkeleton />
              ) : (
                <Box
                  sx={{
                    bgcolor: "common.white",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    overflow: "hidden",
                  }}
                >
                  {/* Header */}
                  <Box sx={{ p: 2 }}>
                    <Typography fontWeight={950} fontSize={18}>
                      Community Post
                    </Typography>
                  </Box>
                  <Divider />

                  {/* Post */}
                  <Box sx={{ p: 2 }}>
                    {!post ? (
                      <Typography color="text.secondary" fontWeight={800}>
                        {(postQuery.error as any)?.message || "Failed to load post"}
                      </Typography>
                    ) : (
                      <>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Avatar src={post.user?.profilePictureUrl ?? undefined}>
                            {(clean(post.user?.name)?.[0] ?? "U").toUpperCase()}
                          </Avatar>

                          <Box sx={{ minWidth: 0, flex: 1 }}>
                            <Typography fontWeight={950} noWrap>
                              {clean(post.user?.name) || "User"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              <TimeAgo iso={post.createdAt} variant="caption" />
                            </Typography>
                          </Box>

                          {!post.isVerified && (
                            <Box
                              sx={{
                                px: 1,
                                py: 0.3,
                                borderRadius: 999,
                                bgcolor: "warning.main",
                                color: "common.white",
                                fontSize: 12,
                                fontWeight: 950,
                              }}
                            >
                              Pending
                            </Box>
                          )}
                        </Stack>

                        <Typography sx={{ mt: 1.25 }} fontWeight={950} fontSize={18}>
                          {clean(post.title)}
                        </Typography>

                        {!!clean(post.content) && (
                          <Typography sx={{ mt: 1 }} color="text.secondary" style={{ whiteSpace: "pre-wrap" }}>
                            {post.content}
                          </Typography>
                        )}

                        {/* ✅ Image (FULL): contain, no crop */}
                        {!!clean(post.imageUrl) && (
                          <Box
                            sx={{
                              mt: 1.5,
                              width: "100%",
                              borderRadius: 2,
                              border: "1px solid",
                              borderColor: "divider",
                              overflow: "hidden",
                              bgcolor: "grey.100",
                            }}
                          >
                            <Box
                              component="img"
                              src={clean(post.imageUrl)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              sx={{
                                width: "100%",
                                height: { xs: "auto", sm: 520 },
                                maxHeight: 520,
                                display: "block",
                                objectFit: "contain",
                                bgcolor: "grey.100",
                              }}
                            />
                          </Box>
                        )}

                        {/* ✅ Video (at end of post) */}
                        {!!embed && (
                          <Box sx={{ mt: 1.5 }}>
                            <Box
                              sx={{
                                width: "100%",
                                aspectRatio: "16 / 9",
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                overflow: "hidden",
                                bgcolor: "common.black",
                              }}
                            >
                              <Box
                                component="iframe"
                                src={embed}
                                title="YouTube video"
                                loading="lazy"
                                sx={{ width: "100%", height: "100%", border: 0 }}
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                allowFullScreen
                              />
                            </Box>
                          </Box>
                        )}

                        {/* Counts */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }}>
                          <Button
                            onClick={() => canInteract && setUsersOpen(true)}
                            disabled={!canInteract}
                            sx={{ textTransform: "none", fontWeight: 950, borderRadius: 999 }}
                          >
                            {likes} Likes · {dislikes} Dislikes
                          </Button>

                          <Box sx={{ flex: 1 }} />

                          <Typography variant="caption" color="text.secondary" fontWeight={900}>
                            {post.commentsCount} comments
                          </Typography>
                        </Stack>

                        <Divider sx={{ my: 1.25 }} />

                        {/* Actions */}
                        <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: "wrap" }}>
                          <ReactionButton
                            active={myReaction === true}
                            label="Like"
                            icon={<ThumbUpAltOutlinedIcon />}
                            onClick={onLike}
                          />
                          <ReactionButton
                            active={myReaction === false}
                            label="Dislike"
                            icon={<ThumbDownAltOutlinedIcon />}
                            onClick={onDislike}
                          />
                          <Button
                            startIcon={<ForumOutlinedIcon />}
                            sx={{ textTransform: "none", fontWeight: 950, borderRadius: 999 }}
                            onClick={() => {
                              const el = document.getElementById("comments");
                              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
                            }}
                          >
                            Comment
                          </Button>

                          {(reactMutation.isPending || addCommentMutation.isPending) && (
                            <Stack direction="row" spacing={1} alignItems="center" sx={{ ml: 1 }}>
                              <CircularProgress size={16} />
                              <Typography variant="caption" color="text.secondary" fontWeight={900}>
                                Updating…
                              </Typography>
                            </Stack>
                          )}
                        </Stack>

                        {/* Comments */}
                        <Box id="comments" sx={{ mt: 2 }}>
                          <Typography fontWeight={950} sx={{ mb: 1 }}>
                            Comments
                          </Typography>

                          {!canInteract ? (
                            <Box
                              sx={{
                                p: 2,
                                borderRadius: 2,
                                border: "1px solid",
                                borderColor: "divider",
                                bgcolor: "grey.50",
                              }}
                            >
                              <Typography fontWeight={900}>Sign in to view and write comments.</Typography>
                              <Typography variant="caption" color="text.secondary">
                                Your backend requires auth for comments and reactions.
                              </Typography>
                            </Box>
                          ) : (
                            <>
                              <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                                <TextField
                                  value={commentText}
                                  onChange={(e) => setCommentText(e.target.value)}
                                  placeholder="Write a comment…"
                                  fullWidth
                                  size="small"
                                />
                                <Button
                                  variant="contained"
                                  onClick={submitComment}
                                  sx={{ textTransform: "none", fontWeight: 950, borderRadius: 2 }}
                                >
                                  Post
                                </Button>
                              </Box>

                              <Box sx={{ mt: 2 }}>
                                {commentsQuery.isLoading ? (
                                  <Stack spacing={1.25}>
                                    <Skeleton variant="rounded" height={92} />
                                    <Skeleton variant="rounded" height={92} />
                                  </Stack>
                                ) : commentsQuery.error ? (
                                  <Typography color="error" fontWeight={900}>
                                    {(commentsQuery.error as any)?.message ?? "Failed to load comments"}
                                  </Typography>
                                ) : (
                                  <Stack spacing={1.25}>
                                    {(commentsQuery.data ?? []).map((c) => (
                                      <Box
                                        key={c.id}
                                        sx={{
                                          p: 1.5,
                                          borderRadius: 2,
                                          border: "1px solid",
                                          borderColor: "divider",
                                          bgcolor: "common.white",
                                        }}
                                      >
                                        <Stack direction="row" spacing={1} alignItems="center">
                                          <Avatar src={c.userPhotoUrl ?? undefined} sx={{ width: 28, height: 28 }}>
                                            {(clean(c.userName)?.[0] ?? "U").toUpperCase()}
                                          </Avatar>

                                          <Box sx={{ minWidth: 0, flex: 1 }}>
                                            <Typography fontWeight={950} fontSize={13} noWrap>
                                              {clean(c.userName) || "User"}
                                            </Typography>
                                            <TimeAgo
                                              iso={c.createdAt}
                                              variant="caption"
                                              sx={{ color: "text.secondary", fontWeight: 900 }}
                                            />
                                          </Box>

                                          {canDeleteComment(c) ? (
                                            <Button
                                              onClick={() => deleteCommentMutation.mutate(c.id)}
                                              sx={{ textTransform: "none", fontWeight: 900 }}
                                            >
                                              Delete
                                            </Button>
                                          ) : null}
                                        </Stack>

                                        <Typography sx={{ mt: 1 }} color="text.secondary" style={{ whiteSpace: "pre-wrap" }}>
                                          {c.content}
                                        </Typography>
                                      </Box>
                                    ))}
                                  </Stack>
                                )}
                              </Box>
                            </>
                          )}
                        </Box>
                      </>
                    )}
                  </Box>
                </Box>
              )}
            </Box>

            {/* RIGHT spacer */}
            <Box sx={{ display: { xs: "none", lg: "block" } }} />
          </Box>

          {/* Mobile/tablet: Latest below */}
          <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
            {latestQuery.isLoading ? (
              <Skeleton variant="rounded" height={420} />
            ) : (
              <TopSideBar title="Latest" items={latestItems as any} onOpen={onOpenNews} />
            )}
          </Box>
        </Box>
      </Box>

      {/* Reaction Users Dialog */}
      <Dialog open={usersOpen} onClose={() => setUsersOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950, pr: 6 }}>
          Reactions
          <IconButton
            onClick={() => setUsersOpen(false)}
            aria-label="Close reactions"
            sx={{ position: "absolute", right: 10, top: 10 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          {!canInteract ? (
            <Typography fontWeight={900}>Sign in to view reaction users.</Typography>
          ) : usersQuery.isLoading ? (
            <Typography color="text.secondary" fontWeight={800}>
              Loading…
            </Typography>
          ) : usersQuery.error ? (
            <Typography color="error" fontWeight={900}>
              {(usersQuery.error as any)?.message ?? "Failed to load users"}
            </Typography>
          ) : (
            <Stack spacing={1}>
              {(usersQuery.data ?? []).map((u) => (
                <Box
                  key={`${u.userId}-${u.createdAt}`}
                  sx={{
                    p: 1.25,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.25,
                  }}
                >
                  <Avatar src={u.userPhotoUrl ?? undefined}>
                    {(clean(u.userName)?.[0] ?? "U").toUpperCase()}
                  </Avatar>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={950} noWrap>
                      {clean(u.userName) || "User"}
                    </Typography>
                    <TimeAgo iso={u.createdAt} variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }} />
                  </Box>

                  <Box
                    sx={{
                      px: 1,
                      py: 0.3,
                      borderRadius: 999,
                      bgcolor: u.isLike ? "success.main" : "error.main",
                      color: "common.white",
                      fontSize: 12,
                      fontWeight: 950,
                    }}
                  >
                    {u.isLike ? "Like" : "Dislike"}
                  </Box>
                </Box>
              ))}
            </Stack>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}