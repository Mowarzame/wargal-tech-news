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

export default function PostComposer({ user }: { user: AuthUser }) {
  const qc = useQueryClient();
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [videoUrl, setVideoUrl] = React.useState("");
  const [imageFiles, setImageFiles] = React.useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = React.useState<string[]>([]);

  React.useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  const pickImages = () => fileInputRef.current?.click();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const incomingFiles = Array.from(e.target.files ?? []).filter((f) =>
      f.type.startsWith("image/")
    );
    if (!incomingFiles.length) {
      e.target.value = "";
      return;
    }

    const nextFiles = [...imageFiles, ...incomingFiles];
    const nextPreviewUrls = [
      ...imagePreviewUrls,
      ...incomingFiles.map((f) => URL.createObjectURL(f)),
    ];

    setImageFiles(nextFiles);
    setImagePreviewUrls(nextPreviewUrls);
    e.target.value = "";
  };

  const removeImageAt = (index: number) => {
    const nextFiles = [...imageFiles];
    const nextPreviews = [...imagePreviewUrls];

    const [removedPreview] = nextPreviews.splice(index, 1);
    nextFiles.splice(index, 1);

    if (removedPreview) URL.revokeObjectURL(removedPreview);

    setImageFiles(nextFiles);
    setImagePreviewUrls(nextPreviews);
  };

  const clearAllImages = () => {
    imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    setImageFiles([]);
    setImagePreviewUrls([]);
  };

  const ytOk = !clean(videoUrl) || !!extractYouTubeId(videoUrl);

  const canSubmit =
    clean(title).length > 0 &&
    (clean(content).length > 0 || imageFiles.length > 0 || clean(videoUrl).length > 0);

  const createMut = useMutation({
    mutationFn: async () => {
      return await createPostWithImage({
        title: clean(title),
        content: clean(content),
        videoUrl: clean(videoUrl) || null,
        imageFiles: imageFiles.length ? imageFiles : null,
      });
    },

    onMutate: async () => {
      await qc.cancelQueries({ queryKey: ["posts"] });

      const prev = qc.getQueryData<PostDto[]>(["posts"]) ?? [];

      const optimistic: PostDto = {
        id: `optimistic-${Math.random().toString(16).slice(2)}`,
        title: clean(title),
        content: clean(content) || "",
        imageUrl: imagePreviewUrls[0] || null,
        imageUrls: [...imagePreviewUrls],
        videoUrl: clean(videoUrl) || null,
        user,
        createdAt: new Date().toISOString(),
        isVerified: user.role?.toLowerCase() === "admin",
        likes: 0,
        dislikes: 0,
        myReaction: null,
        commentsCount: 0,
      } as PostDto;

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
    if (!canSubmit || createMut.isPending || !ytOk) return;

    try {
      await createMut.mutateAsync();
      setTitle("");
      setContent("");
      setVideoUrl("");
      clearAllImages();
    } catch {
      // handled by react-query error state
    }
  };

  return (
    <Card sx={{ borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
      <CardContent>
        <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start" }}>
          <Avatar
            src={clean(user.profilePictureUrl) || undefined}
            sx={{ width: 44, height: 44 }}
          >
            {(clean(user.name)?.[0] ?? "U").toUpperCase()}
          </Avatar>

          <Box sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Post title"
              fullWidth
              size="small"
              sx={{
                mb: 1.25,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "grey.50",
                },
              }}
            />

            <TextField
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What’s on your mind?"
              fullWidth
              multiline
              minRows={3}
              sx={{
                "& .MuiOutlinedInput-root": {
                  borderRadius: 2,
                  bgcolor: "grey.50",
                },
              }}
            />

            <TextField
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="Optional: YouTube video URL (or video id)"
              fullWidth
              size="small"
              sx={{
                mt: 1.25,
                "& .MuiOutlinedInput-root": {
                  borderRadius: 999,
                  bgcolor: "grey.50",
                },
              }}
              error={!ytOk}
              helperText={
                !ytOk ? "Please paste a valid YouTube URL or 11-character video id." : " "
              }
            />

            {imagePreviewUrls.length > 0 && (
              <Box sx={{ mt: 1.25 }}>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns:
                      imagePreviewUrls.length === 1
                        ? "1fr"
                        : imagePreviewUrls.length === 2
                        ? "1fr 1fr"
                        : "2fr 1fr",
                    gap: 1,
                  }}
                >
                  {imagePreviewUrls.length === 1 && (
                    <PreviewTile
                      src={imagePreviewUrls[0]}
                      onRemove={() => removeImageAt(0)}
                      large
                    />
                  )}

                  {imagePreviewUrls.length === 2 && (
                    <>
                      <PreviewTile
                        src={imagePreviewUrls[0]}
                        onRemove={() => removeImageAt(0)}
                      />
                      <PreviewTile
                        src={imagePreviewUrls[1]}
                        onRemove={() => removeImageAt(1)}
                      />
                    </>
                  )}

                  {imagePreviewUrls.length >= 3 && (
                    <>
                      <PreviewTile
                        src={imagePreviewUrls[0]}
                        onRemove={() => removeImageAt(0)}
                        large
                      />

                      <Box sx={{ display: "grid", gridTemplateRows: "1fr 1fr", gap: 1 }}>
                        <PreviewTile
                          src={imagePreviewUrls[1]}
                          onRemove={() => removeImageAt(1)}
                        />
                        <PreviewTile
                          src={imagePreviewUrls[2]}
                          onRemove={() => removeImageAt(2)}
                          overlay={
                            imagePreviewUrls.length > 3
                              ? `+${imagePreviewUrls.length - 3}`
                              : undefined
                          }
                        />
                      </Box>
                    </>
                  )}
                </Box>

                {imagePreviewUrls.length > 3 && (
                  <Box
                    sx={{
                      mt: 1,
                      display: "grid",
                      gridTemplateColumns: { xs: "1fr 1fr", sm: "1fr 1fr 1fr" },
                      gap: 1,
                    }}
                  >
                    {imagePreviewUrls.slice(3).map((src, idx) => (
                      <PreviewTile
                        key={`${src}-${idx + 3}`}
                        src={src}
                        onRemove={() => removeImageAt(idx + 3)}
                        small
                      />
                    ))}
                  </Box>
                )}
              </Box>
            )}

            <Divider sx={{ my: 1.25 }} />

            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{ justifyContent: "space-between" }}
            >
              <Button
                onClick={pickImages}
                startIcon={<PhotoCameraOutlinedIcon />}
                sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
              >
                Photos
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
              multiple
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

function PreviewTile({
  src,
  onRemove,
  overlay,
  large = false,
  small = false,
}: {
  src: string;
  onRemove: () => void;
  overlay?: string;
  large?: boolean;
  small?: boolean;
}) {
  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "grey.100",
        minHeight: small ? 120 : large ? 280 : 180,
      }}
    >
      <Box
        component="img"
        src={src}
        alt="Preview"
        sx={{
          width: "100%",
          height: "100%",
          display: "block",
          objectFit: "cover",
        }}
      />

      {overlay && (
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            bgcolor: "rgba(0,0,0,0.45)",
            color: "common.white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 28,
            fontWeight: 950,
          }}
        >
          {overlay}
        </Box>
      )}

      <IconButton
        onClick={onRemove}
        aria-label="Remove image"
        sx={{
          position: "absolute",
          top: 8,
          right: 8,
          bgcolor: "rgba(0,0,0,0.55)",
          color: "common.white",
          "&:hover": { bgcolor: "rgba(0,0,0,0.72)" },
        }}
      >
        <CloseIcon />
      </IconButton>
    </Box>
  );
}