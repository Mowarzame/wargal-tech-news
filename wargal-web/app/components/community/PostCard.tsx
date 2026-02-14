"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ChatBubbleOutlineIcon from "@mui/icons-material/ChatBubbleOutline";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  addComment,
  fetchComments,
  reactToPost,
  fetchPostReactionsUsers,
  type CommentDto,
  type PostDto,
  type PostReactionUserDto,
} from "@/app/lib/api";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function timeAgoFromIso(iso?: string | null) {
  const s = clean(iso);
  if (!s) return "";
  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";
  const diffMs = Date.now() - dt.getTime();
  if (diffMs < 0) return "just now";
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  return `${day}d`;
}

/**
 * Detects if the Typography content is visually clamped (overflowing).
 * Works reliably for multi-line clamp using -webkit-line-clamp.
 */
function useIsClamped(dep: any) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isClamped, setIsClamped] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      // scrollHeight > clientHeight means overflow (clamped)
      const next = el.scrollHeight > el.clientHeight + 1;
      setIsClamped(next);
    };

    measure();

    // Re-measure on resize (responsive)
    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    return () => ro.disconnect();
  }, [dep]);

  return { ref, isClamped };
}

export default function PostCard({ post }: { post: PostDto }) {
  const router = useRouter();
  const qc = useQueryClient();

  const [commentsOpen, setCommentsOpen] = React.useState(false);
  const [commentText, setCommentText] = React.useState("");

  const [reactionsOpen, setReactionsOpen] = React.useState(false);

  const ago = timeAgoFromIso(post.createdAt);

  const postUrl = `/community/${post.id}`;

  // ✅ clamp detection for 3 lines
  const contentText = clean(post.content);
  const { ref: contentRef, isClamped } = useIsClamped(`${post.id}:${contentText}`);

  // ✅ comments query: keep it live when open
  const commentsQ = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments(post.id),
    enabled: commentsOpen,
    refetchInterval: commentsOpen ? 5_000 : false,
    refetchOnWindowFocus: true,
  });

  // ✅ reaction users list
  const reactionsUsersQ = useQuery({
    queryKey: ["reactionUsers", post.id],
    queryFn: () => fetchPostReactionsUsers(post.id),
    enabled: reactionsOpen,
    refetchInterval: reactionsOpen ? 10_000 : false,
  });

  // ✅ Optimistic reactions (NO disabling UI)
  const reactMut = useMutation({
    mutationFn: (next: boolean | null) => reactToPost(post.id, next),

    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["posts"] });

      const prev = qc.getQueryData<PostDto[]>(["posts"]) ?? [];
      const cur = prev.find((p) => p.id === post.id) ?? post;

      const old = cur.myReaction ?? null;
      let likes = cur.likes ?? 0;
      let dislikes = cur.dislikes ?? 0;

      // remove old
      if (old === true) likes = Math.max(0, likes - 1);
      if (old === false) dislikes = Math.max(0, dislikes - 1);

      // add next
      if (next === true) likes += 1;
      if (next === false) dislikes += 1;

      qc.setQueryData<PostDto[]>(
        ["posts"],
        prev.map((p) => (p.id === post.id ? { ...p, likes, dislikes, myReaction: next } : p))
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      if (reactionsOpen) qc.invalidateQueries({ queryKey: ["reactionUsers", post.id] });
    },
  });

  // ✅ Optimistic add comment (instant)
  const addCommentMut = useMutation({
    mutationFn: (text: string) => addComment(post.id, text),

    onMutate: async (text) => {
      const t = clean(text);

      await qc.cancelQueries({ queryKey: ["comments", post.id] });
      await qc.cancelQueries({ queryKey: ["posts"] });

      const prevComments = qc.getQueryData<CommentDto[]>(["comments", post.id]) ?? [];
      const prevPosts = qc.getQueryData<PostDto[]>(["posts"]) ?? [];

      setCommentsOpen(true);

      const optimistic: CommentDto = {
        id: `optimistic-${Math.random().toString(16).slice(2)}`,
        postId: post.id,
        userId: "me",
        userName: "You",
        userPhotoUrl: null,
        content: t,
        createdAt: new Date().toISOString(),
      };

      qc.setQueryData<CommentDto[]>(["comments", post.id], [optimistic, ...prevComments]);

      qc.setQueryData<PostDto[]>(
        ["posts"],
        prevPosts.map((p) =>
          p.id === post.id ? { ...p, commentsCount: (p.commentsCount ?? 0) + 1 } : p
        )
      );

      return { prevComments, prevPosts, optimisticId: optimistic.id };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prevComments) qc.setQueryData(["comments", post.id], ctx.prevComments);
      if (ctx?.prevPosts) qc.setQueryData(["posts"], ctx.prevPosts);
    },

    onSuccess: (created, _vars, ctx) => {
      const cur = qc.getQueryData<CommentDto[]>(["comments", post.id]) ?? [];
      qc.setQueryData<CommentDto[]>(
        ["comments", post.id],
        cur.map((c) => (c.id === ctx?.optimisticId ? created : c))
      );
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["comments", post.id] });
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const doReact = (val: boolean) => {
    const next = post.myReaction === val ? null : val;
    reactMut.mutate(next);
  };

  const submitComment = () => {
    const c = clean(commentText);
    if (!c) return;
    setCommentText("");
    addCommentMut.mutate(c);
  };

  const comments = (commentsQ.data ?? [])
    .filter(Boolean)
    .sort((a, b) => clean(b.createdAt).localeCompare(clean(a.createdAt)));

  const reactionUsers = (reactionsUsersQ.data ?? []) as PostReactionUserDto[];
  const likesUsers = reactionUsers.filter((u) => u.isLike);
  const dislikesUsers = reactionUsers.filter((u) => !u.isLike);

  return (
    <>
      <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          {/* Header */}
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
            <Avatar src={clean(post.user?.profilePictureUrl) || undefined} sx={{ width: 44, height: 44 }}>
              {(clean(post.user?.name)?.[0] ?? "U").toUpperCase()}
            </Avatar>

            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography fontWeight={950} noWrap>
                {clean(post.user?.name) || "User"}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {ago ? `${ago} · ` : ""}
                {clean(post.user?.role) || "User"}
                {post.isVerified ? " · Verified" : ""}
              </Typography>
            </Box>
          </Box>

          {/* Content */}
          <Box sx={{ mt: 1.25 }}>
            {!!contentText && (
              <Box>
                <Typography
                  ref={contentRef as any}
                  sx={{
                    whiteSpace: "pre-wrap",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                  }}
                  // Facebook-like: clickable when truncated
                  onClick={() => {
                    if (isClamped) router.push(postUrl);
                  }}
                >
                  {contentText}
                </Typography>

                {/* Read more only when truly clamped */}
                {isClamped && (
                  <Button
                    onClick={() => router.push(postUrl)}
                    size="small"
                    sx={{
                      mt: 0.5,
                      textTransform: "none",
                      fontWeight: 950,
                      px: 0,
                      minWidth: 0,
                      justifyContent: "flex-start",
                    }}
                  >
                    Read more
                  </Button>
                )}
              </Box>
            )}

            {!!clean(post.imageUrl) && (
              <Box sx={{ mt: 1.25 }}>
                <Box
                  sx={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    maxHeight: 520,
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
                    sx={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                </Box>
              </Box>
            )}
          </Box>

          {/* Counts + view reactors */}
          <Box sx={{ mt: 1.25, display: "flex", alignItems: "center" }}>
            <Typography variant="caption" color="text.secondary">
              {post.likes ?? 0} likes · {post.dislikes ?? 0} dislikes · {post.commentsCount ?? 0} comments
            </Typography>

            <Box sx={{ flex: 1 }} />

            <Button
              onClick={() => setReactionsOpen(true)}
              size="small"
              sx={{ textTransform: "none", fontWeight: 900 }}
            >
              View reactions
            </Button>
          </Box>

          <Divider sx={{ my: 1.25 }} />

          {/* Actions (NO disabling) */}
          <Stack direction="row" spacing={1} sx={{ justifyContent: "space-between" }}>
            <Button
              onClick={() => doReact(true)}
              startIcon={<ThumbUpAltOutlinedIcon />}
              sx={{
                flex: 1,
                textTransform: "none",
                fontWeight: 900,
                borderRadius: 999,
                bgcolor: post.myReaction === true ? "rgba(21,101,192,0.12)" : "transparent",
              }}
            >
              Like
            </Button>

            <Button
              onClick={() => doReact(false)}
              startIcon={<ThumbDownAltOutlinedIcon />}
              sx={{
                flex: 1,
                textTransform: "none",
                fontWeight: 900,
                borderRadius: 999,
                bgcolor: post.myReaction === false ? "rgba(21,101,192,0.12)" : "transparent",
              }}
            >
              Dislike
            </Button>

            <Button
              onClick={() => setCommentsOpen((v) => !v)}
              startIcon={<ChatBubbleOutlineIcon />}
              sx={{ flex: 1, textTransform: "none", fontWeight: 900, borderRadius: 999 }}
            >
              Comment
            </Button>
          </Stack>

          {/* Comment input */}
          <Box sx={{ mt: 1.25, display: "flex", gap: 1 }}>
            <TextField
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              fullWidth
              size="small"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999, bgcolor: "grey.50" } }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  submitComment();
                }
              }}
            />
            <Button
              variant="contained"
              onClick={submitComment}
              disabled={!clean(commentText)}
              sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999, px: 2.5 }}
            >
              Send
            </Button>
          </Box>

          {/* Comments list */}
          {commentsOpen && (
            <Box sx={{ mt: 1.25 }}>
              {commentsQ.isError ? (
                <Typography variant="caption" color="error">
                  {(commentsQ.error as any)?.message ?? "Failed to load comments"}
                </Typography>
              ) : (
                <Box>
                  {comments.map((c) => (
                    <Box key={c.id} sx={{ mt: 1 }}>
                      <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                        <Avatar src={clean(c.userPhotoUrl) || undefined} sx={{ width: 28, height: 28 }}>
                          {(clean(c.userName)?.[0] ?? "U").toUpperCase()}
                        </Avatar>

                        <Box
                          sx={{
                            bgcolor: "grey.50",
                            border: "1px solid",
                            borderColor: "divider",
                            borderRadius: 2,
                            px: 1.25,
                            py: 0.8,
                            flex: 1,
                          }}
                        >
                          <Typography fontWeight={900} fontSize={13}>
                            {clean(c.userName) || "User"}
                          </Typography>
                          <Typography fontSize={13} sx={{ whiteSpace: "pre-wrap" }}>
                            {clean(c.content)}
                          </Typography>
                        </Box>
                      </Box>
                    </Box>
                  ))}

                  {(reactMut.isPending || addCommentMut.isPending) && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                      Syncing…
                    </Typography>
                  )}
                </Box>
              )}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Reactions Users Dialog */}
      <Dialog open={reactionsOpen} onClose={() => setReactionsOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 950 }}>Reactions</DialogTitle>
        <DialogContent>
          {reactionsUsersQ.isLoading ? (
            <Typography color="text.secondary">Loading…</Typography>
          ) : reactionsUsersQ.isError ? (
            <Typography color="error">
              {(reactionsUsersQ.error as any)?.message ?? "Failed to load reactions"}
            </Typography>
          ) : (
            <Box>
              <Typography fontWeight={950} sx={{ mt: 1 }}>
                Likes ({likesUsers.length})
              </Typography>
              <Box sx={{ mt: 1 }}>
                {likesUsers.length === 0 ? (
                  <Typography color="text.secondary">No likes yet</Typography>
                ) : (
                  likesUsers.map((u) => (
                    <Box key={`${u.userId}-like`} sx={{ display: "flex", gap: 1, alignItems: "center", py: 0.75 }}>
                      <Avatar src={clean(u.userPhotoUrl) || undefined} sx={{ width: 28, height: 28 }}>
                        {(clean(u.userName)?.[0] ?? "U").toUpperCase()}
                      </Avatar>
                      <Typography fontWeight={900}>{clean(u.userName) || "User"}</Typography>
                    </Box>
                  ))
                )}
              </Box>

              <Divider sx={{ my: 2 }} />

              <Typography fontWeight={950}>Dislikes ({dislikesUsers.length})</Typography>
              <Box sx={{ mt: 1 }}>
                {dislikesUsers.length === 0 ? (
                  <Typography color="text.secondary">No dislikes yet</Typography>
                ) : (
                  dislikesUsers.map((u) => (
                    <Box
                      key={`${u.userId}-dislike`}
                      sx={{ display: "flex", gap: 1, alignItems: "center", py: 0.75 }}
                    >
                      <Avatar src={clean(u.userPhotoUrl) || undefined} sx={{ width: 28, height: 28 }}>
                        {(clean(u.userName)?.[0] ?? "U").toUpperCase()}
                      </Avatar>
                      <Typography fontWeight={900}>{clean(u.userName) || "User"}</Typography>
                    </Box>
                  ))
                )}
              </Box>
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
