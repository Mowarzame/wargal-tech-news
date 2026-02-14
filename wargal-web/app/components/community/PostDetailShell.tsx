// ==============================
// File: wargal-web/app/components/community/PostDetailShell.tsx
// ==============================
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

// Your API wraps responses in { data, message, success }
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

// ---------- API calls (aligned to your backend routes) ----------
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

async function reactToPost(postId: string, isLike: boolean | null): Promise<{
  likes: number;
  dislikes: number;
  myReaction: boolean | null;
}> {
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

export default function PostDetailShell({ postId }: { postId: string }) {
  const qc = useQueryClient();
  const { isReady, isAuthed } = useAuth();

  // Right sidebar: latest news (same look as News page)
  const latestQuery = useQuery({
    queryKey: ["latestNews5"],
    queryFn: async () => {
      const items = await fetchFeedItems({ page: 1, pageSize: 12 });
      return (items ?? []).slice(0, 5);
    },
    staleTime: 60_000,
  });

  // Post query (works without auth; when authed it includes myReaction)
  const postQuery = useQuery({
    queryKey: ["post", postId],
    queryFn: () => getPost(postId),
    staleTime: 10_000,
    refetchInterval: 20_000,
  });

  // Comments (backend requires auth)
  const commentsQuery = useQuery({
    queryKey: ["comments", postId],
    queryFn: () => getComments(postId),
    enabled: isReady && isAuthed,
    staleTime: 5_000,
    refetchInterval: 8_000,
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

  // --------- Optimistic reaction mutation ----------
  const reactMutation = useMutation({
    mutationFn: (isLike: boolean | null) => reactToPost(postId, isLike),
    onMutate: async (nextReaction) => {
      await qc.cancelQueries({ queryKey: ["post", postId] });

      const prev = qc.getQueryData<PostDto>(["post", postId]);
      if (!prev) return { prev };

      const prevMy = prev.myReaction ?? null;
      let likes = prev.likes ?? 0;
      let dislikes = prev.dislikes ?? 0;

      // undo previous
      if (prevMy === true) likes = Math.max(0, likes - 1);
      if (prevMy === false) dislikes = Math.max(0, dislikes - 1);

      // apply next
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

  // --------- Optimistic add comment ----------
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
        userId: "me",
        userName: "You",
        userPhotoUrl: null,
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
      // replace temp with real
      const cur = qc.getQueryData<CommentDto[]>(["comments", postId]) ?? [];
      const next = cur.map((c) => (c.id.startsWith("temp-") ? created : c));
      qc.setQueryData(["comments", postId], next);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", postId] });
      qc.invalidateQueries({ queryKey: ["post", postId] });
    },
  });

  // --------- Delete comment (optimistic) ----------
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

  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 720px) 360px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* CENTER */}
          <Box sx={{ minWidth: 0 }}>
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
                    {postQuery.isLoading ? "Loading post…" : postQuery.error?.message || "Failed to load post"}
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
                      <Typography sx={{ mt: 1 }} color="text.secondary">
                        {post.content}
                      </Typography>
                    )}

                    {!!clean(post.imageUrl) && (
                      <Box
                        sx={{
                          mt: 1.5,
                          width: "100%",
                          height: { xs: 220, sm: 320, md: 380 },
                          borderRadius: 2,
                          border: "1px solid",
                          borderColor: "divider",
                          overflow: "hidden",
                          bgcolor: "grey.100",
                          backgroundImage: `url(${post.imageUrl})`,
                          backgroundSize: "cover",
                          backgroundPosition: "center",
                        }}
                      />
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

                    {/* Actions (optimistic; no disabled “loading” flicker) */}
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

                      {/* Silent background spinner (no disabling UI) */}
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
                          <Typography fontWeight={900}>
                            Sign in to view and write comments.
                          </Typography>
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
                              <Typography color="text.secondary" fontWeight={800}>
                                Loading comments…
                              </Typography>
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

                                      {/* Keep delete visible only if your backend allows; otherwise remove */}
                                      <Button
                                        onClick={() => deleteCommentMutation.mutate(c.id)}
                                        sx={{ textTransform: "none", fontWeight: 900 }}
                                      >
                                        Delete
                                      </Button>
                                    </Stack>

                                    <Typography sx={{ mt: 1 }} color="text.secondary">
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
          </Box>

          {/* RIGHT: Latest (desktop only; keeps same UI style you used) */}
          <Box sx={{ display: { xs: "none", lg: "block" }, position: "sticky", top: 86, alignSelf: "start" }}>
            <TopSideBar title="Latest" items={latestItems as any} onOpen={() => {}} />
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
                    <TimeAgo
                      iso={u.createdAt}
                      variant="caption"
                      sx={{ color: "text.secondary", fontWeight: 900 }}
                    />
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
