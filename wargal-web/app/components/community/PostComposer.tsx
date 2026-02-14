"use client";

import * as React from "react";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  IconButton,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import CloseIcon from "@mui/icons-material/Close";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { createPostWithImage, type AuthUser, type PostDto } from "@/app/lib/api";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function deriveTitle(content: string) {
  const c = clean(content);
  if (!c) return "Post";
  return c.length > 60 ? `${c.slice(0, 60)}…` : c;
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

export default function PostComposer({ user }: { user: AuthUser }) {
  const qc = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [content, setContent] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [imageFile, setImageFile] = React.useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = React.useState<string>("");

  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    };
  }, [imagePreviewUrl]);

  const pickImage = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    if (!f.type.startsWith("image/")) return;

    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImageFile(f);
    setImagePreviewUrl(URL.createObjectURL(f));
    e.target.value = "";
  };

  const removeImage = () => {
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl("");
    setImageFile(null);
  };

  const ytOk = !clean(videoUrl) || !!extractYouTubeId(videoUrl);
  const canSubmit = clean(content).length > 0 || !!imageFile || clean(videoUrl).length > 0;

  const createMut = useMutation({
    mutationFn: async () => {
      const c = clean(content);
      const title = deriveTitle(c || "Post");
      const v = clean(videoUrl) || null;

      return await createPostWithImage({
        title,
        content: c || "",
        videoUrl: v,
        imageFile: imageFile ?? null,
      });
    },

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["posts"] });
      const prev = qc.getQueryData<PostDto[]>(["posts"]) ?? [];

      const optimistic: PostDto = {
        id: `optimistic-${Math.random().toString(16).slice(2)}`,
        title: deriveTitle(clean(content) || "Post"),
        content: clean(content) || "",
        imageUrl: imagePreviewUrl || null,
        videoUrl: clean(videoUrl) || null,
        user,
        createdAt: new Date().toISOString(),
        isVerified: user.role?.toLowerCase() === "admin",
        likes: 0,
        dislikes: 0,
        myReaction: null,
        commentsCount: 0,
      };

      qc.setQueryData<PostDto[]>(["posts"], [optimistic, ...prev]);
      return { prev, optimisticId: optimistic.id };
    },

    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(["posts"], ctx.prev);
    },

    onSuccess: (created, _vars, ctx) => {
      const cur = qc.getQueryData<PostDto[]>(["posts"]) ?? [];
      qc.setQueryData<PostDto[]>(
        ["posts"],
        cur.map((p) => (p.id === ctx?.optimisticId ? created : p))
      );
    },

    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["posts"] });
    },
  });

  const submit = async () => {
    if (!canSubmit || createMut.isPending) return;
    if (!ytOk) return;

    try {
      await createMut.mutateAsync();
      setContent("");
      setVideoUrl("");
      removeImage();
    } catch {}
  };

  return (
    <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
          <Avatar src={clean(user.profilePictureUrl) || undefined} sx={{ width: 44, height: 44 }}>
            {(clean(user.name)?.[0] ?? "U").toUpperCase()}
          </Avatar>

          <Box sx={{ flex: 1 }}>
            <TextField
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What’s on your mind?"
              fullWidth
              multiline
              minRows={2}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 999, bgcolor: "grey.50" } }}
            />

            {/* ✅ Optional YouTube URL */}
            <TextField
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Optional: YouTube video URL (or video id)"
              fullWidth
              size="small"
              sx={{ mt: 1, "& .MuiOutlinedInput-root": { borderRadius: 999, bgcolor: "grey.50" } }}
              error={!ytOk}
              helperText={!ytOk ? "Please paste a valid YouTube URL or 11-char video id." : " "}
            />

            {/* Preview image */}
            {imagePreviewUrl && (
              <Box sx={{ mt: 1.25, position: "relative" }}>
                <Box
                  sx={{
                    width: "100%",
                    aspectRatio: "16 / 9",
                    maxHeight: 420,
                    borderRadius: 2,
                    border: "1px solid",
                    borderColor: "divider",
                    overflow: "hidden",
                    bgcolor: "grey.100",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    component="img"
                    src={imagePreviewUrl}
                    alt="Preview"
                    sx={{ width: "100%", height: "100%", objectFit: "contain" }}
                  />
                </Box>

                <IconButton
                  onClick={removeImage}
                  aria-label="Remove image"
                  sx={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    bgcolor: "rgba(0,0,0,0.55)",
                    color: "common.white",
                    "&:hover": { bgcolor: "rgba(0,0,0,0.7)" },
                  }}
                >
                  <CloseIcon />
                </IconButton>
              </Box>
            )}

            <Divider sx={{ my: 1.25 }} />

            <Stack direction="row" spacing={1} alignItems="center" sx={{ justifyContent: "space-between" }}>
              <Button
                onClick={pickImage}
                startIcon={<PhotoCameraOutlinedIcon />}
                sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
              >
                Photo
              </Button>

              <Box sx={{ flex: 1 }} />

              <Button
                variant="contained"
                onClick={submit}
                disabled={createMut.isPending || !canSubmit || !ytOk}
                sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
              >
                {createMut.isPending ? "Posting…" : "Post"}
              </Button>
            </Stack>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={onFileChange}
            />

            {!!createMut.error && (
              <Typography color="error" sx={{ mt: 1, fontWeight: 900 }}>
                {(createMut.error as any)?.message ?? "Failed to create post"}
              </Typography>
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}
