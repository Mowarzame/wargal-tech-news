// ==============================
// File: wargal-web/app/components/Home/HomeShell.tsx
// ==============================
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  Checkbox,
  Divider,
  Avatar,
  Drawer,
  Button,
  IconButton,
  Chip,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  Stack,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";

import { fetchFeedItems, fetchFeedSources } from "@/app/lib/api";
import { NewsItem, NewsSource } from "@/app/types/news";

import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";
import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import FourUpRow from "@/app/components/news/FourUpRow";
import TopSideBar from "@/app/components/news/TopSidebar";
import CategoryLanes from "@/app/components/news/CategoryLanes";
import FilteredNewsGrid from "@/app/components/news/FilteredNewsGrid";
import TimeAgo from "@/app/components/common/TimeAgo";

const REFRESH_MS = 2 * 60 * 1000;

type Props = {
  items: NewsItem[];
  sources: NewsSource[];
  categoryBySourceId: Record<string, string>;
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

function keyOf(it?: NewsItem | null) {
  if (!it) return "";
  const u = clean(it.url);
  return u ? `u:${u}` : `id:${clean(it.id)}`;
}

function mergeTop(prev: NewsItem[], next: NewsItem[]) {
  const out: NewsItem[] = [];
  const seen = new Set<string>();

  const add = (it?: NewsItem | null) => {
    if (!it) return;
    const k = keyOf(it);
    if (!k || seen.has(k)) return;
    seen.add(k);
    out.push(it);
  };

  for (const it of next ?? []) add(it);
  for (const it of prev ?? []) add(it);

  return out;
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);

    // youtu.be/<id>
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }

    // youtube.com/watch?v=<id>
    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;

      // youtube.com/embed/<id>
      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      // youtube.com/shorts/<id>
      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * SourcesPanel:
 * - Keeps your current structure
 * - Category chips row becomes hamburger dropdown:
 *   Selected LEFT, icon RIGHT
 */
function SourcesPanel({
  q,
  setQ,
  isAll,
  selectedIds,
  clearSelection,
  filteredSources,
  selectedSet,
  toggleSource,
  showTitle,
  categories,
  selectedCategory,
  setSelectedCategory,
}: {
  q: string;
  setQ: (v: string) => void;
  isAll: boolean;
  selectedIds: string[];
  clearSelection: () => void;
  filteredSources: NewsSource[];
  selectedSet: Set<string>;
  toggleSource: (id: string) => void;
  showTitle: boolean;
  categories: string[];
  selectedCategory: string;
  setSelectedCategory: (v: string) => void;
}) {
  const [catAnchor, setCatAnchor] = useState<null | HTMLElement>(null);
  const catOpen = Boolean(catAnchor);

  const openCats = (e: React.MouseEvent<HTMLElement>) => setCatAnchor(e.currentTarget);
  const closeCats = () => setCatAnchor(null);

  const activeLabel = selectedCategory || "All";

  return (
    <>
      <Box sx={{ p: 1.5 }}>
        {showTitle && (
          <Typography fontWeight={900} mb={1}>
            Sources
          </Typography>
        )}

        <TextField
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search…"
          size="small"
          fullWidth
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
          }}
        />

        {/* ✅ Category dropdown (selected left, hamburger right) */}
        <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
          <Chip
            label={activeLabel}
            size="small"
            variant={activeLabel === "All" ? "filled" : "outlined"}
            sx={{ fontWeight: 900, borderRadius: 999 }}
          />

          <Box sx={{ flex: 1 }} />

          <IconButton
            onClick={openCats}
            size="small"
            aria-label="Open source category menu"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 2,
              bgcolor: "common.white",
            }}
          >
            <MenuIcon fontSize="small" />
          </IconButton>

          <Menu
            anchorEl={catAnchor}
            open={catOpen}
            onClose={closeCats}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            PaperProps={{ sx: { minWidth: 220, borderRadius: 2 } }}
          >
            {categories.map((cat) => {
              const active = cat === selectedCategory;
              return (
                <MenuItem
                  key={cat}
                  selected={active}
                  onClick={() => {
                    setSelectedCategory(cat);
                    closeCats();
                  }}
                  sx={{ fontWeight: active ? 900 : 700 }}
                >
                  {cat}
                </MenuItem>
              );
            })}
          </Menu>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
          <Typography
            onClick={clearSelection}
            sx={{
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 900,
              color: "text.secondary",
              userSelect: "none",
            }}
          >
            CLEAR
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Typography variant="caption" color="text.secondary">
            {isAll ? "All" : `${selectedIds.length}`}
          </Typography>
        </Box>
      </Box>

      <Divider />

      <Box sx={{ flex: 1, overflow: "auto", p: 1 }}>
        {filteredSources.map((s) => {
          const id = String(s.id);
          const checked = selectedSet.has(id);

          return (
            <Box
              key={id}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                px: 1,
                py: 1,
                borderRadius: 2,
                cursor: "pointer",
                "&:hover": { bgcolor: "grey.50" },
              }}
              onClick={() => toggleSource(id)}
            >
              <Avatar src={s.iconUrl ?? undefined} sx={{ width: 26, height: 26 }}>
                {(clean(s.name)?.[0] ?? "S").toUpperCase()}
              </Avatar>

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography fontWeight={800} fontSize={13} noWrap>
                  {clean(s.name) || "Source"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {clean(s.category) || "News"}
                </Typography>
              </Box>

              <Checkbox checked={checked} />
            </Box>
          );
        })}
      </Box>
    </>
  );
}

export default function HomeShell({ items, sources, categoryBySourceId }: Props) {
  const [allItems, setAllItems] = useState<NewsItem[]>((items ?? []).filter(Boolean));
  const [allSources, setAllSources] = useState<NewsSource[]>(
    (sources ?? []).filter(Boolean).filter((s) => s.isActive !== false)
  );

  const [refreshing, setRefreshing] = useState(false);

  // Source search + selection
  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // empty => all sources

  // Left panel source-category dropdown
  const [sourceCategory, setSourceCategory] = useState<string>("All");

  // ✅ Breaking category menu next to "Breaking"
  const [breakingCategory, setBreakingCategory] = useState<string>("All");
  const [breakingAnchor, setBreakingAnchor] = useState<null | HTMLElement>(null);

  // Mobile sources drawer
  const [sourcesOpen, setSourcesOpen] = useState(false);

  // ✅ Reader modal
  const [openItem, setOpenItem] = useState<NewsItem | null>(null);

  const selectedSet = useMemo(() => new Set((selectedIds ?? []).map(String)), [selectedIds]);
  const isAllSources = selectedIds.length === 0;
  const isSingleSource = selectedIds.length === 1;

  // Auto refresh (items + sources)
  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        setRefreshing(true);

        const [src, feed] = await Promise.all([
          fetchFeedSources().catch(() => null),
          fetchFeedItems({ page: 1, pageSize: 120 }).catch(() => []),
        ]);

        if (!alive) return;

        if (src) {
          setAllSources((src ?? []).filter(Boolean).filter((s) => s.isActive !== false));
        }

        setAllItems((prev) => mergeTop(prev ?? [], (feed ?? []).filter(Boolean)));
      } finally {
        if (alive) setRefreshing(false);
      }
    }

    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  // Source categories from sources
  const sourceCategories = useMemo(() => {
    const set = new Set<string>();
    for (const s of allSources ?? []) {
      const c = clean(s?.category) || "News";
      set.add(c);
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["All", ...list];
  }, [allSources]);

  useEffect(() => {
    if (!sourceCategories.includes(sourceCategory)) setSourceCategory("All");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceCategories.join("|")]);

  // ✅ Breaking categories from categoryBySourceId map (server-built)
  const breakingCategories = useMemo(() => {
    const set = new Set<string>();
    for (const k of Object.keys(categoryBySourceId ?? {})) {
      const c = clean(categoryBySourceId[k]) || "General";
      set.add(c);
    }
    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return ["All", ...list];
  }, [categoryBySourceId]);

  useEffect(() => {
    if (!breakingCategories.includes(breakingCategory)) setBreakingCategory("All");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breakingCategories.join("|")]);

  const filteredSources = useMemo(() => {
    const query = clean(q).toLowerCase();
    const list = (allSources ?? []).filter(Boolean);

    const byCat =
      sourceCategory === "All"
        ? list
        : list.filter((s) => (clean(s.category) || "News") === sourceCategory);

    if (!query) return byCat;
    return byCat.filter((s) => clean(s.name).toLowerCase().includes(query));
  }, [allSources, q, sourceCategory]);

  // Apply selected sourceId filter
  const filteredItemsBySource = useMemo(() => {
    const list = (allItems ?? []).filter(Boolean);

    if (isAllSources) return list;

    return list.filter((it) => {
      const sid = clean(it?.sourceId);
      return sid && selectedSet.has(String(sid));
    });
  }, [allItems, isAllSources, selectedSet]);

  // Sort by ISO string (no hydration mismatch)
  const sorted = useMemo(() => {
    const list = [...filteredItemsBySource];
    list.sort((a, b) => clean(b?.publishedAt).localeCompare(clean(a?.publishedAt)));
    return list;
  }, [filteredItemsBySource]);

  // ✅ Apply breakingCategory to center content
  const sortedByCategory = useMemo(() => {
    if (breakingCategory === "All") return sorted;

    return sorted.filter((it) => {
      const cat = clean(categoryBySourceId[String(it?.sourceId ?? "")]) || "General";
      return cat === breakingCategory;
    });
  }, [sorted, breakingCategory, categoryBySourceId]);

  // Sections (from sortedByCategory)
  const breakingItems = useMemo(() => {
    const out: NewsItem[] = [];
    const seen = new Set<string>();
    for (const it of sortedByCategory) {
      const k = keyOf(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= 6) break;
    }
    return out;
  }, [sortedByCategory]);

  const highlightItems = useMemo(() => breakingItems.slice(0, 6), [breakingItems]);

  const latestItems = useMemo(() => {
    const out: NewsItem[] = [];
    const seen = new Set<string>();
    for (const it of sorted) {
      const k = keyOf(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= 7) break;
    }
    return out;
  }, [sorted]);

  const moreStories = useMemo(() => sortedByCategory.slice(6, 30), [sortedByCategory]);

  const emptySingleSource = isSingleSource && sortedByCategory.length === 0;

  const toggleSource = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(Array.from(next));
  };

  const clearSelection = () => setSelectedIds([]);

  // ✅ Open in modal instead of new window
  const onOpen = (it?: NewsItem | null) => {
    if (!it) return;
    setOpenItem(it);
  };

  const closeModal = () => setOpenItem(null);

  // ✅ IMPORTANT: never return empty string for iframe src
  const modalUrl = useMemo(() => safeUrl(openItem?.url), [openItem]);

  const isVideo = openItem?.kind === 2;

  const ytId = useMemo(() => {
    const url = safeUrl(openItem?.url);
    if (!url) return null;
    return extractYoutubeId(url);
  }, [openItem]);

  const youtubeEmbedSrc = useMemo(() => {
    if (!ytId) return null;
    return `https://www.youtube.com/embed/${ytId}?autoplay=1`;
  }, [ytId]);

  // Mobile sources drawer
  const openSources = () => setSourcesOpen(true);
  const closeSources = () => setSourcesOpen(false);

  // Breaking category menu handlers (next to title)
  const openBreakingMenu = (e: React.MouseEvent<HTMLElement>) => setBreakingAnchor(e.currentTarget);
  const closeBreakingMenu = () => setBreakingAnchor(null);

  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
        {/* Small screens: selection summary + Sources button */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            gap: 1,
            mb: 1.5,
          }}
        >
          <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {sourceCategory === "All" ? "All categories" : sourceCategory} ·{" "}
            {isAllSources ? "All sources" : `${selectedIds.length} selected`}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Button
            onClick={openSources}
            variant="contained"
            startIcon={<MenuIcon />}
            sx={{
              textTransform: "none",
              fontWeight: 900,
              borderRadius: 999,
              flexShrink: 0,
            }}
          >
            Sources
          </Button>
        </Box>

        {/* Mobile: Sources Drawer */}
        <Drawer
          open={sourcesOpen}
          onClose={closeSources}
          anchor="left"
          PaperProps={{
            sx: {
              width: { xs: "86vw", sm: 360 },
              maxWidth: "100%",
              display: "flex",
              flexDirection: "column",
            },
          }}
        >
          <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography fontWeight={950} sx={{ flex: 1 }}>
              Sources
            </Typography>
            <IconButton onClick={closeSources} aria-label="Close sources">
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          <SourcesPanel
            q={q}
            setQ={setQ}
            isAll={isAllSources}
            selectedIds={selectedIds}
            clearSelection={clearSelection}
            filteredSources={filteredSources}
            selectedSet={selectedSet}
            toggleSource={toggleSource}
            showTitle={false}
            categories={sourceCategories}
            selectedCategory={sourceCategory}
            setSelectedCategory={setSourceCategory}
          />
        </Drawer>

        {/* Layout: Left / Center / Right */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "260px minmax(0,1fr) 360px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* LEFT: Sources (desktop) */}
          <Box
            sx={{
              display: { xs: "none", lg: "block" },
              position: "sticky",
              top: 86,
              alignSelf: "start",
              height: "calc(100vh - 110px)",
              minHeight: 420,
            }}
          >
            <Box
              sx={{
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <SourcesPanel
                q={q}
                setQ={setQ}
                isAll={isAllSources}
                selectedIds={selectedIds}
                clearSelection={clearSelection}
                filteredSources={filteredSources}
                selectedSet={selectedSet}
                toggleSource={toggleSource}
                showTitle={true}
                categories={sourceCategories}
                selectedCategory={sourceCategory}
                setSelectedCategory={setSourceCategory}
              />
            </Box>
          </Box>

          {/* CENTER */}
          <Box sx={{ minWidth: 0 }}>
            {emptySingleSource ? (
              <Box
                sx={{
                  bgcolor: "common.white",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  p: 3,
                }}
              >
                <Typography fontWeight={950} fontSize={18}>
                  No feed items available
                </Typography>
                <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                  This source currently has no articles/videos. Try another source or clear the filter.
                </Typography>
              </Box>
            ) : (
              <>
                {/* Breaking header + category menu next to it */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1 }}>
                    Breaking
                  </Typography>

                  <Chip
                    label={breakingCategory}
                    size="small"
                    variant={breakingCategory === "All" ? "filled" : "outlined"}
                    sx={{ fontWeight: 900, borderRadius: 999 }}
                  />

                  <Box sx={{ flex: 1 }} />

                  <IconButton
                    onClick={openBreakingMenu}
                    size="small"
                    aria-label="Open breaking category menu"
                    sx={{
                      border: "1px solid",
                      borderColor: "divider",
                      borderRadius: 2,
                      bgcolor: "common.white",
                    }}
                  >
                    <MenuIcon fontSize="small" />
                  </IconButton>

                  <Menu
                    anchorEl={breakingAnchor}
                    open={Boolean(breakingAnchor)}
                    onClose={closeBreakingMenu}
                    anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                    transformOrigin={{ vertical: "top", horizontal: "right" }}
                    PaperProps={{ sx: { minWidth: 220, borderRadius: 2 } }}
                  >
                    {breakingCategories.map((cat) => {
                      const active = cat === breakingCategory;
                      return (
                        <MenuItem
                          key={cat}
                          selected={active}
                          onClick={() => {
                            setBreakingCategory(cat);
                            closeBreakingMenu();
                          }}
                          sx={{ fontWeight: active ? 900 : 700 }}
                        >
                          {cat}
                        </MenuItem>
                      );
                    })}
                  </Menu>
                </Box>

                <BreakingSlideshow items={breakingItems} onOpen={(it) => onOpen(it)} />

                <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                  Highlights
                </Typography>
                <NewsGridHighlights items={highlightItems} onOpen={(it) => onOpen(it)} />

                {/* Small screen: Latest here */}
                <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
                  <TopSideBar title="Latest" items={latestItems} onOpen={(it) => onOpen(it)} />
                </Box>

                {/* Desktop: More Stories here */}
                <Box sx={{ display: { xs: "none", lg: "block" } }}>
                  <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                    More Stories
                  </Typography>
                  <FourUpRow items={moreStories} onOpen={(it) => onOpen(it)} />
                </Box>

                <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                  Categories
                </Typography>
                <CategoryLanes
                  items={sortedByCategory}
                  getCategory={(sourceId?: string) =>
                    clean(categoryBySourceId[String(sourceId ?? "")]) || "General"
                  }
                  onOpen={(it) => onOpen(it)}
                />

                <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                  All News
                </Typography>
                <FilteredNewsGrid
                  selectedSourceIds={selectedIds}
                  initialItems={sortedByCategory.slice(0, 60)}
                  pageSize={60}
                />
              </>
            )}
          </Box>

          {/* RIGHT: Latest (desktop sticky) */}
          <Box
            sx={{
              position: "sticky",
              top: 86,
              alignSelf: "start",
              display: { xs: "none", lg: "block" },
            }}
          >
            <TopSideBar title="Latest" items={latestItems} onOpen={(it) => onOpen(it)} />
          </Box>
        </Box>

        {/* Small screen: More Stories at bottom */}
        <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
          <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
            More Stories
          </Typography>
          <FourUpRow items={moreStories} onOpen={(it) => onOpen(it)} />
        </Box>

        <Box sx={{ mt: 2 }}>
          <Typography variant="caption" color="text.secondary">
            {refreshing ? "Auto-refreshing…" : "Auto-refresh every 2 minutes"}
          </Typography>
        </Box>
      </Box>

      {/* ✅ Modal Reader (Article / YouTube) */}
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

            {/* ✅ TimeAgo in modal */}
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
          {/* If url is missing/invalid -> DO NOT render iframe */}
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
              {/* ✅ Only render iframe when src exists */}
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
                sx={{
                  width: "100%",
                  height: "100%",
                  border: 0,
                  bgcolor: "common.white",
                }}
              />
            </Box>
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}
