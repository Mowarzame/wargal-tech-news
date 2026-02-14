// ==============================
// File: wargal-web/app/components/news/FilteredNewsGrid.tsx
// ==============================
"use client";

import React, { useMemo, useState } from "react";
import {
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Avatar,
  Stack,
  Button,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";

/**
 * This component expects the parent to provide initialItems and
 * then it can render "All News" grid. (Matches your HomeShell usage.)
 *
 * If your existing component also fetches more items, keep that logic —
 * only replace the open handler with `setOpenItem(it)` and keep everything else.
 */

type Props = {
  selectedSourceIds: string[];
  initialItems: NewsItem[];
  pageSize?: number;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function isHttpUrl(u?: string | null) {
  const url = clean(u);
  return url.startsWith("http://") || url.startsWith("https://");
}

function safeUrl(u?: string | null) {
  const url = clean(u);
  return isHttpUrl(url) ? url : "";
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }

    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);

      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

function pickThumb(it?: NewsItem | null) {
  const img = clean(it?.imageUrl);
  if (img) return img;
  const icon = clean(it?.sourceIconUrl);
  if (icon) return icon;
  return "/placeholder-news.jpg";
}

export default function FilteredNewsGrid({
  selectedSourceIds,
  initialItems,
  pageSize = 60,
}: Props) {
  // ✅ Hooks first (prevents "Rendered fewer hooks" issues)
  const [openItem, setOpenItem] = useState<NewsItem | null>(null);

  const list = useMemo(() => (initialItems ?? []).filter(Boolean), [initialItems]);

  // ✅ modal safe values
  const modalUrl = useMemo(() => safeUrl(openItem?.url), [openItem]);
  const isVideo = openItem?.kind === 2;

  const ytId = useMemo(() => {
    const u = safeUrl(openItem?.url);
    if (!u) return null;
    return extractYoutubeId(u);
  }, [openItem]);

  const youtubeEmbedSrc = useMemo(() => {
    if (!ytId) return null;
    return `https://www.youtube.com/embed/${ytId}?autoplay=1`;
  }, [ytId]);

  // If you had filtering by selectedSourceIds inside this component,
  // keep it here. For now, the parent already passes filtered items.
  const displayItems = useMemo(() => {
    const ids = (selectedSourceIds ?? []).map(String).filter(Boolean);
    if (!ids.length) return list;
    const set = new Set(ids);
    return list.filter((it) => it?.sourceId && set.has(String(it.sourceId)));
  }, [list, selectedSourceIds]);

  const closeModal = () => setOpenItem(null);

  return (
    <>
      {/* GRID (keep your current layout if different) */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0,1fr))",
            md: "repeat(3, minmax(0,1fr))",
          },
          gap: 2,
        }}
      >
        {displayItems.slice(0, pageSize).map((it, idx) => {
          const thumb = pickThumb(it);
          const title = clean(it?.title) || "(Untitled)";
          const source = clean(it?.sourceName) || "Source";

          return (
            <Box
              key={clean(it?.id) || `${idx}`}
              onClick={() => it && setOpenItem(it)}
              sx={{
                cursor: "pointer",
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                "&:hover": { boxShadow: 2 },
              }}
            >
              <Box
                sx={{
                  height: 160,
                  backgroundImage: `url(${thumb})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  bgcolor: "grey.100",
                }}
              />

              <Box sx={{ p: 1.5 }}>
                <Typography fontWeight={950} sx={{ lineHeight: 1.2 }}>
                  {title}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                  <Avatar src={it?.sourceIconUrl ?? undefined} sx={{ width: 20, height: 20 }}>
                    {(source[0] ?? "S").toUpperCase()}
                  </Avatar>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {source}
                  </Typography>

                  {it?.kind === 2 && (
                    <Box
                      sx={{
                        px: 0.9,
                        py: 0.2,
                        borderRadius: 999,
                        bgcolor: "error.main",
                        color: "common.white",
                        fontSize: 11,
                        fontWeight: 900,
                      }}
                    >
                      Video
                    </Box>
                  )}
                </Stack>

                {!!clean(it?.publishedAt) && (
                  <TimeAgo
                    iso={it?.publishedAt}
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 900, mt: 0.75, display: "block" }}
                  />
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* ✅ Modal Reader */}
      <Dialog open={!!openItem} onClose={closeModal} fullWidth maxWidth="lg">
        <DialogTitle sx={{ fontWeight: 950, pr: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography fontWeight={950} sx={{ flex: 1, minWidth: 0 }} noWrap>
              {clean(openItem?.title) || "Read"}
            </Typography>

            <IconButton onClick={closeModal} aria-label="Close reader">
              <CloseIcon />
            </IconButton>
          </Box>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
            <Avatar src={openItem?.sourceIconUrl ?? undefined} sx={{ width: 22, height: 22 }}>
              {(clean(openItem?.sourceName)?.[0] ?? "S").toUpperCase()}
            </Avatar>

            <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
              {clean(openItem?.sourceName) || "Source"}
            </Typography>

            <Box sx={{ flex: 1 }} />

            {!!clean(openItem?.publishedAt) && (
              <TimeAgo
                iso={openItem?.publishedAt}
                variant="caption"
                sx={{ color: "text.secondary", fontWeight: 900 }}
              />
            )}
          </Stack>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {!modalUrl ? (
            <Box sx={{ p: 3 }}>
              <Typography fontWeight={950} fontSize={16}>
                This item can’t be opened in the modal
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                The feed item URL is missing or not a valid absolute URL.
              </Typography>

              <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {!!clean(openItem?.url) && (
                  <Button
                    variant="outlined"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => window.open(clean(openItem?.url)!, "_blank", "noopener,noreferrer")}
                    sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                  >
                    Open in new tab
                  </Button>
                )}
                <Button
                  variant="contained"
                  onClick={closeModal}
                  sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                >
                  Close
                </Button>
              </Box>
            </Box>
          ) : isVideo ? (
            <Box sx={{ width: "100%", aspectRatio: "16 / 9", bgcolor: "black" }}>
              {youtubeEmbedSrc ? (
                <Box
                  component="iframe"
                  src={youtubeEmbedSrc}
                  title="YouTube video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  sx={{ width: "100%", height: "100%", border: 0 }}
                />
              ) : (
                <Box sx={{ p: 3, color: "common.white" }}>
                  <Typography fontWeight={950}>Video link detected but YouTube ID not found.</Typography>
                  <Typography sx={{ opacity: 0.85, mt: 0.5 }}>
                    We couldn’t parse a YouTube ID from this URL. You can still open it externally.
                  </Typography>

                  <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                    <Button
                      variant="contained"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => window.open(modalUrl, "_blank", "noopener,noreferrer")}
                      sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                    >
                      Open in new tab
                    </Button>
                    <Button
                      variant="outlined"
                      onClick={closeModal}
                      sx={{
                        textTransform: "none",
                        fontWeight: 900,
                        borderRadius: 999,
                        color: "common.white",
                        borderColor: "rgba(255,255,255,0.6)",
                      }}
                    >
                      Close
                    </Button>
                  </Box>
                </Box>
              )}
            </Box>
          ) : (
            <Box sx={{ height: "calc(100vh - 220px)", minHeight: 520 }}>
              <Box
                component="iframe"
                src={modalUrl}
                title="Article"
                sx={{ width: "100%", height: "100%", border: 0, bgcolor: "common.white" }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
