// ==============================
// File: wargal-web/app/components/news/FilteredNewsGrid.tsx
// ==============================
"use client";

import React, { useEffect, useMemo, useState } from "react";
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
  Divider,
  useMediaQuery,
  Collapse,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTheme } from "@mui/material/styles";

import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  selectedSourceIds: string[];
  initialItems: NewsItem[];
  selectedCategory?: string;
  getCategory?: (sourceId?: string | null) => string;
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

// ✅ Precise related matching helpers
function tokenizeTitle(s?: string | null) {
  const t = clean(s).toLowerCase();
  if (!t) return [];
  const raw = t
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\s]/g, " ")
    .split(/\s+/)
    .map((x) => x.trim())
    .filter(Boolean);

  const stop = new Set([
    "iyo",
    "oo",
    "ka",
    "ku",
    "la",
    "ah",
    "in",
    "aa",
    "uu",
    "u",
    "a",
    "the",
    "and",
    "of",
    "to",
    "for",
    "with",
    "on",
    "at",
    "by",
    "from",
  ]);

  return raw
    .filter((w) => w.length >= 4)
    .filter((w) => !stop.has(w))
    .slice(0, 60);
}

function countSharedTokens(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length || !bTokens.length) return 0;
  const a = new Set(aTokens);
  let hit = 0;
  for (const t of bTokens) if (a.has(t)) hit++;
  return hit;
}

function scoreMatch(baseTokens: string[], candTokens: string[]) {
  const shared = countSharedTokens(baseTokens, candTokens);
  if (shared <= 0) return 0;

  const required = baseTokens.length <= 6 ? 1 : 2;
  if (shared < required) return 0;

  const denom = Math.max(8, Math.min(baseTokens.length, 18));
  return shared / denom;
}

export default function FilteredNewsGrid({
  selectedSourceIds,
  initialItems,
  selectedCategory = "All",
  getCategory,
  pageSize = 60,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [openItem, setOpenItem] = useState<NewsItem | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(pageSize);

  const [mobileRelatedOpen, setMobileRelatedOpen] = useState(false);
  useEffect(() => {
    if (isMobile) setMobileRelatedOpen(false);
  }, [openItem?.id, openItem?.url, isMobile]);

  const list = useMemo(() => (initialItems ?? []).filter(Boolean), [initialItems]);

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

  const displayItems = useMemo(() => {
    const ids = (selectedSourceIds ?? []).map(String).filter(Boolean);
    const bySource = !ids.length
      ? list
      : (() => {
          const set = new Set(ids);
          return list.filter((it) => it?.sourceId && set.has(String(it.sourceId)));
        })();

    const cat = clean(selectedCategory) || "All";
    if (cat === "All") return bySource;

    return bySource.filter((it) => {
      const sid = it?.sourceId ? String(it.sourceId) : "";
      const c =
        (getCategory ? clean(getCategory(sid)) : "") ||
        clean((it as any)?.sourceCategory) ||
        "General";
      return c === cat;
    });
  }, [list, selectedSourceIds, selectedCategory, getCategory]);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [pageSize, selectedCategory, selectedSourceIds.join("|"), displayItems.length]);

  const canLoadMore = displayItems.length > visibleCount;

  const closeModal = () => setOpenItem(null);

  const relatedVideos = useMemo(() => {
    if (!openItem) return [] as NewsItem[];

    const baseTitle = clean(openItem?.title);
    const baseTokens = tokenizeTitle(baseTitle);

    const baseUrl = clean(openItem?.url);
    const baseId = clean(openItem?.id);

    const candidates = (displayItems ?? [])
      .filter(Boolean)
      .filter((it) => it?.kind === 2)
      .filter((it) => safeUrl(it?.url))
      .filter((it) => {
        if (baseId && clean(it?.id) === baseId) return false;
        if (baseUrl && clean(it?.url) === baseUrl) return false;
        return true;
      });

    const scored = candidates
      .map((it) => {
        const candTitle = clean(it?.title);
        const candTokens = tokenizeTitle(candTitle);

        const baseScore = scoreMatch(baseTokens, candTokens);
        if (baseScore <= 0) return null;

        const sameSource =
          clean(String(it?.sourceId ?? "")) === clean(String(openItem?.sourceId ?? ""));
        const score = baseScore + (sameSource ? 0.08 : 0);

        if (baseScore < 0.22 && !sameSource) return null;

        return { it, score };
      })
      .filter(Boolean) as Array<{ it: NewsItem; score: number }>;

    scored.sort((a, b) => b.score - a.score);

    const out: NewsItem[] = [];
    const seen = new Set<string>();

    for (const x of scored) {
      const k = clean(x.it?.id) || clean(x.it?.url);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(x.it);
      if (out.length >= 4) break;
    }

    return out;
  }, [openItem, displayItems]);

  const relatedLimit = isMobile ? 3 : 4;

  return (
    <>
      {/* GRID (unchanged) */}
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
        {displayItems.slice(0, visibleCount).map((it, idx) => {
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

      {/* ✅ Load More */}
      <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
        {canLoadMore ? (
          <Button
            variant="contained"
            onClick={() => setVisibleCount((n) => n + pageSize)}
            sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999, px: 3 }}
          >
            Load more
          </Button>
        ) : null}
      </Box>

      {/* ✅ Modal (small screens: centered, background visible, compact collapsible related max 3) */}
      <Dialog
        open={!!openItem}
        onClose={closeModal}
        fullWidth
        maxWidth={false}
        PaperProps={{
          sx: {
            borderRadius: { xs: 3, sm: 3 },
            m: { xs: 2, sm: 2 },
            width: { xs: "92vw", sm: "min(1180px, 96vw)" },
            maxWidth: "100%",
            height: { xs: "auto", sm: "min(82vh, 820px)" },
            maxHeight: { xs: "92vh", sm: "82vh" },
            overflow: "hidden",
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 950, pr: 6, px: { xs: 2, sm: 3 } }}>
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
          </Stack>
        </DialogTitle>

        <DialogContent
          sx={{
            p: 0,
            overflow: "hidden",
            height: { xs: "auto", sm: "calc(100% - 96px)" },
          }}
        >
          {!modalUrl ? (
            <Box sx={{ p: 3 }}>
              <Typography fontWeight={950} fontSize={16}>
                This item can’t be opened in the modal
              </Typography>
              <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                The feed item URL is missing or not a valid absolute URL.
              </Typography>
            </Box>
          ) : isVideo ? (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "minmax(0, 1fr) 360px" },
                alignItems: "stretch",
                bgcolor: "common.white",
                height: { xs: "auto", sm: "100%" },
              }}
            >
              {/* VIDEO COLUMN */}
              <Box sx={{ minWidth: 0, display: "flex", flexDirection: "column" }}>
                <Box
                  sx={{
                    width: "100%",
                    bgcolor: "black",
                    flex: { xs: "0 0 auto", md: "1 1 auto" },
                    minHeight: { md: 520 },
                    aspectRatio: { xs: "16 / 9", md: "auto" } as any,
                  }}
                >
                  {youtubeEmbedSrc ? (
                    <Box
                      component="iframe"
                      src={youtubeEmbedSrc}
                      title="YouTube video"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      sx={{ width: "100%", height: "100%", border: 0, display: "block" }}
                    />
                  ) : (
                    <Box sx={{ p: 3, color: "common.white" }}>
                      <Typography fontWeight={950}>Video link detected but YouTube ID not found.</Typography>
                      <Button
                        variant="contained"
                        startIcon={<OpenInNewIcon />}
                        onClick={() => window.open(modalUrl, "_blank", "noopener,noreferrer")}
                        sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999, mt: 2 }}
                      >
                        Open in new tab
                      </Button>
                    </Box>
                  )}
                </Box>

                {/* Mobile/Small: collapsible related (max 3, compact) */}
                <Box sx={{ display: { xs: "block", md: "none" }, bgcolor: "common.white", borderTop: "1px solid", borderColor: "divider" }}>
                  <Box
                    onClick={() => relatedVideos.length && setMobileRelatedOpen((v) => !v)}
                    sx={{
                      px: 2,
                      py: 1.25,
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      cursor: relatedVideos.length ? "pointer" : "default",
                      userSelect: "none",
                    }}
                  >
                    <Typography fontWeight={950} sx={{ flex: 1 }}>
                      Related videos{relatedVideos.length ? ` (${Math.min(3, relatedVideos.length)})` : ""}
                    </Typography>

                    {relatedVideos.length ? (
                      <IconButton
                        size="small"
                        aria-label="Toggle related videos"
                        onClick={(e) => {
                          e.stopPropagation();
                          setMobileRelatedOpen((v) => !v);
                        }}
                      >
                        {mobileRelatedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                      </IconButton>
                    ) : null}
                  </Box>

                  <Collapse in={mobileRelatedOpen} timeout={200} unmountOnExit>
                    <Box sx={{ px: 2, pb: 1.5 }}>
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
                        {relatedVideos.slice(0, 3).map((rv, i) => {
                          const title = clean(rv?.title) || "Video";
                          const src = clean(rv?.sourceName) || "Source";
                          const thumb = pickThumb(rv);

                          return (
                            <Box
                              key={clean(rv?.id) || `${i}`}
                              onClick={() => setOpenItem(rv)}
                              sx={{
                                display: "flex",
                                gap: 1,
                                alignItems: "center",
                                border: "1px solid",
                                borderColor: "divider",
                                borderRadius: 2,
                                p: 0.75,
                                cursor: "pointer",
                                "&:hover": { bgcolor: "grey.50" },
                                minWidth: 0,
                              }}
                            >
                              <Avatar src={thumb} sx={{ width: 30, height: 30 }}>
                                {(src[0] ?? "V").toUpperCase()}
                              </Avatar>

                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography fontWeight={900} fontSize={12} noWrap>
                                  {title}
                                </Typography>
                                <Typography variant="caption" color="text.secondary" noWrap>
                                  {src}
                                </Typography>
                              </Box>

                              <IconButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const u = safeUrl(rv?.url);
                                  if (!u) return;
                                  window.open(u, "_blank", "noopener,noreferrer");
                                }}
                                size="small"
                                aria-label="Open in new tab"
                              >
                                <OpenInNewIcon sx={{ fontSize: 16 }} />
                              </IconButton>
                            </Box>
                          );
                        })}
                      </Box>
                    </Box>
                  </Collapse>
                </Box>
              </Box>

              {/* RIGHT: related videos (desktop/tablet) */}
              <Box
                sx={{
                  display: { xs: "none", md: "block" },
                  bgcolor: "common.white",
                  borderLeft: "1px solid",
                  borderColor: "divider",
                  height: "100%",
                  overflow: "hidden",
                }}
              >
                <Box sx={{ p: 2 }}>
                  <Typography fontWeight={950} sx={{ mb: 1 }}>
                    Related videos
                  </Typography>

                  {relatedVideos.length === 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      No related videos found for this title yet.
                    </Typography>
                  ) : (
                    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                      {relatedVideos.slice(0, 4).map((rv, i) => {
                        const title = clean(rv?.title) || "Video";
                        const src = clean(rv?.sourceName) || "Source";
                        const thumb = pickThumb(rv);

                        return (
                          <Box
                            key={clean(rv?.id) || `${i}`}
                            onClick={() => setOpenItem(rv)}
                            sx={{
                              display: "flex",
                              gap: 1,
                              alignItems: "center",
                              border: "1px solid",
                              borderColor: "divider",
                              borderRadius: 2,
                              p: 1,
                              cursor: "pointer",
                              "&:hover": { bgcolor: "grey.50" },
                              minWidth: 0,
                            }}
                          >
                            <Avatar src={thumb} sx={{ width: 36, height: 36 }}>
                              {(src[0] ?? "V").toUpperCase()}
                            </Avatar>

                            <Box sx={{ minWidth: 0, flex: 1 }}>
                              <Typography fontWeight={900} fontSize={13} noWrap>
                                {title}
                              </Typography>
                              <Typography variant="caption" color="text.secondary" noWrap>
                                {src}
                              </Typography>
                            </Box>

                            <IconButton
                              onClick={(e) => {
                                e.stopPropagation();
                                const u = safeUrl(rv?.url);
                                if (!u) return;
                                window.open(u, "_blank", "noopener,noreferrer");
                              }}
                              size="small"
                              aria-label="Open in new tab"
                            >
                              <OpenInNewIcon sx={{ fontSize: 18 }} />
                            </IconButton>
                          </Box>
                        );
                      })}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          ) : (
            <Box
              sx={{
                height: { xs: "70vh", sm: "100%" },
                minHeight: { xs: 420, sm: 520 },
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box
                sx={{
                  px: 2,
                  py: 1,
                  borderBottom: "1px solid",
                  borderColor: "divider",
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  bgcolor: "common.white",
                  flexWrap: "wrap",
                }}
              >
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                  If the page is blank, the site blocks embedding. Use{" "}
                  <span style={{ fontWeight: 950 }}>Open in new tab</span>.
                </Typography>

                <Box sx={{ flex: 1 }} />

                <Button
                  onClick={() => window.open(modalUrl, "_blank", "noopener,noreferrer")}
                  variant="contained"
                  startIcon={<OpenInNewIcon />}
                  sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                >
                  Open in new tab
                </Button>
              </Box>

              <Box
                component="iframe"
                src={modalUrl}
                title="Article"
                sx={{ width: "100%", height: "100%", border: 0, bgcolor: "common.white" }}
              />
            </Box>
          )}

          <Divider sx={{ display: { xs: "block", md: "none" } }} />
        </DialogContent>
      </Dialog>
    </>
  );
}
