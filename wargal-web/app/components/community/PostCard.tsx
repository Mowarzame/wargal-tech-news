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
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
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
  getPostImages,
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
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w ago`;
  const month = Math.floor(day / 30);
  if (month < 12) return `${month}mo ago`;
  const year = Math.floor(day / 365);
  return `${year}y ago`;
}

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
    if (
      shortsIdx >= 0 &&
      parts[shortsIdx + 1] &&
      /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIdx + 1])
    ) {
      return parts[shortsIdx + 1];
    }

    const embedIdx = parts.findIndex((p) => p === "embed");
    if (
      embedIdx >= 0 &&
      parts[embedIdx + 1] &&
      /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])
    ) {
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

function useIsClamped(dep: string) {
  const ref = React.useRef<HTMLDivElement | null>(null);
  const [isClamped, setIsClamped] = React.useState(false);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () => {
      setIsClamped(el.scrollHeight > el.clientHeight + 1);
    };

    measure();

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
  const postUrl = `/editors/${post.id}`;

  const titleText = clean(post.title);
  const contentText = clean(post.content);
  const postImages = getPostImages(post);
  const embed = youtubeEmbedUrl(post.videoUrl);

  const { ref: contentRef, isClamped } = useIsClamped(`${post.id}:${contentText}`);

  const commentsQ = useQuery({
    queryKey: ["comments", post.id],
    queryFn: () => fetchComments(post.id),
    enabled: true,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  const reactionsUsersQ = useQuery({
    queryKey: ["reactionUsers", post.id],
    queryFn: () => fetchPostReactionsUsers(post.id),
    enabled: reactionsOpen,
    refetchInterval: reactionsOpen ? 10_000 : false,
  });

  const reactMut = useMutation({
    mutationFn: (next: boolean | null) => reactToPost(post.id, next),

    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["posts"] });

      const prev = qc.getQueryData<PostDto[]>(["posts"]) ?? [];
      const cur = prev.find((p) => p.id === post.id) ?? post;

      const old = cur.myReaction ?? null;
      let likes = cur.likes ?? 0;
      let dislikes = cur.dislikes ?? 0;

      if (old === true) likes = Math.max(0, likes - 1);
      if (old === false) dislikes = Math.max(0, dislikes - 1);

      if (next === true) likes += 1;
      if (next === false) dislikes += 1;

      qc.setQueryData<PostDto[]>(
        ["posts"],
        prev.map((p) =>
          p.id === post.id ? { ...p, likes, dislikes, myReaction: next } : p
        )
      );

      return { prev };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["comments", post.id] });
      if (reactionsOpen) {
        qc.invalidateQueries({ queryKey: ["reactionUsers", post.id] });
      }
    },
  });

  const addCommentMut = useMutation({
    mutationFn: (text: string) => addComment(post.id, text),

    onMutate: async (text) => {
      const t = clean(text);

      await qc.cancelQueries({ queryKey: ["comments", post.id] });
      await qc.cancelQueries({ queryKey: ["posts"] });

      const prevComments = qc.getQueryData<CommentDto[]>(["comments", post.id]) ?? [];
      const prevPosts = qc.getQueryData<PostDto[]>(["posts"]) ?? [];

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
          p.id === post.id
            ? { ...p, commentsCount: (p.commentsCount ?? 0) + 1 }
            : p
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

  const allComments = (commentsQ.data ?? [])
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const visibleComments = commentsOpen ? allComments : allComments.slice(0, 2);

  const reactionUsers = (reactionsUsersQ.data ?? []) as PostReactionUserDto[];
  const likesUsers = reactionUsers.filter((u) => u.isLike);
  const dislikesUsers = reactionUsers.filter((u) => !u.isLike);

  return (
    <>
      <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
        <CardContent>
          <Box sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
            <Avatar
              src={clean(post.user?.profilePictureUrl) || undefined}
              sx={{ width: 44, height: 44 }}
            >
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

          <Box sx={{ mt: 1.25 }}>
            {titleText && (
              <Typography
                fontWeight={950}
                fontSize={22}
                lineHeight={1.2}
                sx={{ mb: contentText ? 1 : 0 }}
              >
                {titleText}
              </Typography>
            )}

            {contentText && (
              <Box>
                <Typography
                  ref={contentRef as any}
                  sx={{
                    whiteSpace: "pre-wrap",
                    display: "-webkit-box",
                    WebkitBoxOrient: "vertical",
                    WebkitLineClamp: 3,
                    overflow: "hidden",
                    color: "text.secondary",
                  }}
                >
                  {contentText}
                </Typography>

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

            {postImages.length > 0 && (
              <Box sx={{ mt: 1.25 }}>
                <PostFeedImages images={postImages} />
              </Box>
            )}

            {!!embed && (
              <Box sx={{ mt: 1.25 }}>
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
          </Box>

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

          <Box sx={{ mt: 1.25 }}>
            {commentsQ.isError ? (
              <Typography variant="caption" color="error">
                {(commentsQ.error as any)?.message ?? "Failed to load comments"}
              </Typography>
            ) : (
              <Box>
                {visibleComments.map((c) => (
                  <Box key={c.id} sx={{ mt: 1 }}>
                    <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
                      <Avatar
                        src={clean(c.userPhotoUrl) || undefined}
                        sx={{ width: 28, height: 28 }}
                      >
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
                        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.4, display: "block" }}>
                          {timeAgoFromIso(c.createdAt)}
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                ))}

                {allComments.length > 2 && (
                  <Button
                    onClick={() => setCommentsOpen((v) => !v)}
                    size="small"
                    sx={{
                      mt: 1,
                      textTransform: "none",
                      fontWeight: 900,
                      px: 0,
                      minWidth: 0,
                    }}
                  >
                    {commentsOpen ? "Show less comments" : `Load more comments (${allComments.length - 2})`}
                  </Button>
                )}

                {(reactMut.isPending || addCommentMut.isPending) && (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: "block" }}>
                    Syncing…
                  </Typography>
                )}
              </Box>
            )}
          </Box>
        </CardContent>
      </Card>

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
                    <Box key={`${u.userId}-dislike`} sx={{ display: "flex", gap: 1, alignItems: "center", py: 0.75 }}>
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

function PostFeedImages({ images }: { images: string[] }) {
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);

  const openAt = (i: number) => {
    setIndex(i);
    setOpen(true);
  };

  return (
    <>
      {images.length === 1 ? (
        <FeedImageTile src={images[0]} onClick={() => openAt(0)} large />
      ) : images.length === 2 ? (
        <Box sx={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 1 }}>
          <FeedImageTile src={images[0]} onClick={() => openAt(0)} />
          <FeedImageTile src={images[1]} onClick={() => openAt(1)} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 1 }}>
            <FeedImageTile src={images[0]} onClick={() => openAt(0)} large />
            <Box sx={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 1 }}>
              <FeedImageTile src={images[1]} onClick={() => openAt(1)} />
              <FeedImageTile
                src={images[2]}
                onClick={() => openAt(2)}
                overlay={images.length > 3 ? `+${images.length - 3}` : undefined}
              />
            </Box>
          </Box>

          {images.length > 3 && (
            <Box
              sx={{
                mt: 1,
                display: "grid",
                gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
                gap: 1,
              }}
            >
              {images.slice(3).map((src, idx) => (
                <FeedImageTile
                  key={`${src}-${idx}`}
                  src={src}
                  onClick={() => openAt(idx + 3)}
                  small
                />
              ))}
            </Box>
          )}
        </>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 950, pr: 6 }}>
          Photos
          <IconButton
            onClick={() => setOpen(false)}
            aria-label="Close photos"
            sx={{ position: "absolute", right: 10, top: 10 }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent>
          <Box
            sx={{
              width: "100%",
              height: { xs: 320, sm: 520, md: 620 },
              bgcolor: "common.black",
              borderRadius: 2,
              overflow: "hidden",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Box
              component="img"
              src={images[index]}
              alt=""
              sx={{ width: "100%", height: "100%", objectFit: "contain" }}
            />
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.25 }}>
            <Button onClick={() => setIndex((v) => Math.max(0, v - 1))} disabled={index === 0}>
              Prev
            </Button>
            <Typography sx={{ flex: 1, textAlign: "center", fontWeight: 900 }}>
              {images.length ? `${index + 1} / ${images.length}` : "0 / 0"}
            </Typography>
            <Button
              onClick={() => setIndex((v) => Math.min(images.length - 1, v + 1))}
              disabled={index >= images.length - 1}
            >
              Next
            </Button>
          </Stack>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FeedImageTile({
  src,
  onClick,
  overlay,
  large = false,
  small = false,
}: {
  src: string;
  onClick: () => void;
  overlay?: string;
  large?: boolean;
  small?: boolean;
}) {
  return (
    <Box
      onClick={onClick}
      sx={{
        position: "relative",
        cursor: "pointer",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.100",
        minHeight: small ? 140 : large ? 380 : 220,
      }}
    >
      <Box
        component="img"
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />

      {overlay && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.42)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "common.white",
            fontWeight: 950,
            fontSize: 32,
          }}
        >
          {overlay}
        </Box>
      )}
    </Box>
  );
}