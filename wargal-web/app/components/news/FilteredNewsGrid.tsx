// ==============================
// File: wargal-web/app/components/news/FilteredNewsGrid.tsx
// ✅ FIX: stop AI auto-regenerating (remove nowTick from runKey usage)
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
  Chip,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { useTheme } from "@mui/material/styles";

import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";
import AiSomaliSummary from "@/app/components/ai/AiSomaliSummary";

type Props = {
  selectedSourceIds: string[];
  initialItems: NewsItem[];
  selectedCategory?: string;
  getCategory?: (sourceId?: string | null) => string;
  pageSize?: number;

  onOpen?: (it: NewsItem) => void;
  onOpenAi?: (it: NewsItem) => void;
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

      const liveIdx = parts.indexOf("live");
      if (liveIdx >= 0 && parts[liveIdx + 1]) return parts[liveIdx + 1];
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
  onOpen,
  onOpenAi,
}: Props) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const externalControl = typeof onOpen === "function";

  const [openItem, setOpenItem] = useState<NewsItem | null>(null);

  const [aiOpen, setAiOpen] = useState(false);
  const closeAi = () => setAiOpen(false);

  const [visibleCount, setVisibleCount] = useState<number>(pageSize);

  // ✅ Force “time ago” updates (every 60s)
  const [nowTick, setNowTick] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

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
    return `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&modestbranding=1&rel=0`;
  }, [ytId]);

  const iframeSrc = useMemo(() => {
    if (!modalUrl) return "";
    if (isVideo && youtubeEmbedSrc) return youtubeEmbedSrc;
    return modalUrl;
  }, [modalUrl, isVideo, youtubeEmbedSrc]);

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
        "News";
      return c === cat;
    });
  }, [list, selectedSourceIds, selectedCategory, getCategory]);

  useEffect(() => {
    setVisibleCount(pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageSize, selectedCategory, selectedSourceIds.join("|"), displayItems.length]);

  const canLoadMore = displayItems.length > visibleCount;

  const closeReader = () => setOpenItem(null);

  const openReader = (it: NewsItem) => {
    if (externalControl) {
      onOpen?.(it);
      return;
    }
    setOpenItem(it);
  };

  const openAiFor = (it: NewsItem) => {
    if (externalControl) {
      if (onOpenAi) return onOpenAi(it);
      onOpen?.(it);
      return;
    }
    setOpenItem(it);
    setAiOpen(true);
  };


  const canUseAi = (it?: NewsItem | null) => {
  if (!it) return false;

  const kind = it.kind;

  // ✅ type1 RSS only: must have summary
  if (kind === 1) return !!clean((it as any)?.summary);

  // ✅ type2 videos only if category is ForeignNews
  if (kind === 2) {
    const sid = it?.sourceId ? String(it.sourceId) : "";
    const cat =
      (getCategory ? clean(getCategory(sid)) : "") ||
      clean((it as any)?.sourceCategory);

    return cat === "ForeignNews";
  }

  return false;
};
  // ✅ stable AI runKey (NO nowTick)
  const aiRunKey = useMemo(() => {
    const k = clean(openItem?.id) || clean(openItem?.url) || "x";
    return `${k}-ai-open`;
  }, [openItem, aiOpen]);

  const aiKind: 1 | 2 = openItem?.kind === 2 ? 2 : 1;

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

        const sameSource = clean(String(it?.sourceId ?? "")) === clean(String(openItem?.sourceId ?? ""));
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

  const RelatedList = (
    <Box sx={{ p: 2 }}>
      <Typography fontWeight={950} sx={{ mb: 1 }}>
        Related videos
      </Typography>

      {relatedVideos.length ? (
        <Stack spacing={1.25}>
          {relatedVideos.map((rv) => {
            const thumb = pickThumb(rv);
            const title = clean(rv?.title) || "(Untitled)";
            const source = clean(rv?.sourceName) || "Source";

            return (
              <Box
                key={clean(rv?.id) || clean(rv?.url)}
                onClick={() => openReader(rv)}
                sx={{
                  cursor: "pointer",
                  display: "flex",
                  gap: 1.25,
                  p: 1,
                  borderRadius: 2,
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "common.white",
                  "&:hover": { boxShadow: 1 },
                }}
              >
                <Box
                  sx={{
                    width: 92,
                    height: 56,
                    borderRadius: 1.5,
                    backgroundImage: `url(${thumb})`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    bgcolor: "grey.100",
                    flex: "0 0 auto",
                  }}
                />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={900} sx={{ fontSize: 13, lineHeight: 1.2 }} noWrap>
                    {title}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.6 }}>
                    <Avatar src={rv?.sourceIconUrl ?? undefined} sx={{ width: 18, height: 18 }}>
                      {(source[0] ?? "S").toUpperCase()}
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                      {source}
                    </Typography>
                  </Stack>

                  {!!clean(rv?.publishedAt) && (
                    <TimeAgo
                      iso={rv?.publishedAt}
                      variant="caption"
                      sx={{ color: "text.secondary", fontWeight: 900, mt: 0.5, display: "block" }}
                    />
                  )}
                </Box>
              </Box>
            );
          })}
        </Stack>
      ) : (
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 800 }}>
          No related videos found.
        </Typography>
      )}
    </Box>
  );

  return (
    <>
      {/* GRID */}
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
              key={clean(it?.id) || clean(it?.url) || `${idx}`}
              onClick={() => openReader(it)}
              sx={{
                cursor: "pointer",
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                "&:hover": { boxShadow: 2 },
                position: "relative",
              }}
            >
{canUseAi(it) && (
  <Chip
    icon={<AutoAwesomeIcon />}
    label="AI"
    size="small"
    onClick={(e) => {
      e.stopPropagation();
      openAiFor(it);
    }}
    sx={{
      position: "absolute",
      top: 10,
      right: 10,
      fontWeight: 900,
      borderRadius: 999,
      bgcolor: "common.white",
      border: "1px solid",
      borderColor: "divider",
      "&:hover": { bgcolor: "grey.50" },
    }}
  />
)}

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

      {/* Load More */}
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

      {/* Reader Modal (ONLY when FilteredNewsGrid controls the modal itself) */}
      {!externalControl && (
        <Dialog
          open={!!openItem && !aiOpen}
          onClose={closeReader}
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

              {!!openItem && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<AutoAwesomeIcon />}
                  onClick={() => openAiFor(openItem)}
                  sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                >
                  Soo koob (AI)
                </Button>
              )}

              <IconButton onClick={closeReader} aria-label="Close reader">
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
                  key={`${clean(openItem?.id) || clean(openItem?.url)}-${nowTick}`}
                  iso={openItem?.publishedAt}
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 900 }}
                />
              )}
            </Stack>
          </DialogTitle>

          <DialogContent
            sx={{
              p: 0,
              overflow: "hidden",
              height: { xs: "auto", sm: "calc(100% - 96px)" },
            }}
          >
            {!iframeSrc ? (
              <Box sx={{ p: 3 }}>
                <Typography fontWeight={950} fontSize={16}>
                  This item can’t be opened in the modal
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  The feed item URL is missing or not a valid absolute URL.
                </Typography>

                {!!modalUrl && (
                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant="contained"
                      startIcon={<OpenInNewIcon />}
                      onClick={() => window.open(modalUrl, "_blank", "noopener,noreferrer")}
                      sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                    >
                      Open in new tab
                    </Button>
                  </Box>
                )}
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
                    display: "flex",
                    flex: 1,
                    minHeight: 0,
                    flexDirection: { xs: "column", md: "row" },
                  }}
                >
                  <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, bgcolor: "common.white" }}>
                    <Box
                      component="iframe"
                      src={iframeSrc}
                      title={isVideo ? "YouTube video" : "Article"}
                      allow={
                        isVideo
                          ? "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          : undefined
                      }
                      allowFullScreen={isVideo ? true : undefined}
                      referrerPolicy="strict-origin-when-cross-origin"
                      sx={{ width: "100%", height: "100%", border: 0, bgcolor: "common.white" }}
                    />
                  </Box>

                  <Box
                    sx={{
                      display: { xs: "none", md: "block" },
                      width: 360,
                      borderLeft: "1px solid",
                      borderColor: "divider",
                      bgcolor: "grey.50",
                      overflow: "auto",
                    }}
                  >
                    {RelatedList}
                  </Box>

                  <Box sx={{ display: { xs: "block", md: "none" } }}>
                    <Divider />
                    <Box sx={{ px: 2, py: 1.25, bgcolor: "grey.50" }}>
                      <Button
                        fullWidth
                        variant="outlined"
                        onClick={() => setMobileRelatedOpen((v) => !v)}
                        endIcon={mobileRelatedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                        sx={{
                          textTransform: "none",
                          fontWeight: 900,
                          borderRadius: 999,
                          justifyContent: "space-between",
                        }}
                      >
                        Related videos
                      </Button>

                      <Collapse in={mobileRelatedOpen} timeout={180}>
                        <Box sx={{ mt: 1.25 }}>{RelatedList}</Box>
                      </Collapse>
                    </Box>
                  </Box>
                </Box>
              </Box>
            )}

            <Divider sx={{ display: { xs: "block", md: "none" } }} />
          </DialogContent>
        </Dialog>
      )}

      {/* NOTE:
         This component doesn’t render a separate AI modal currently (HomeShell does).
         We still fixed runKey logic here so it won’t ever re-run due to nowTick.
      */}
      {false && aiOpen && openItem ? (
        <AiSomaliSummary
          kind={aiKind}
          title={clean(openItem?.title)}
          url={clean(openItem?.url)}
          sourceName={clean(openItem?.sourceName)}
          summary={clean((openItem as any)?.summary)}
          autoRun
          runKey={aiRunKey}
        />
      ) : null}
    </>
  );
}