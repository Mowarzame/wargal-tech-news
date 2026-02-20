// ==============================
// File: wargal-web/app/components/Home/HomeShell.tsx
// ✅ RULE ENFORCED:
//    - Global sections show ONLY items whose source category == "News"
//      (Breaking slideshow, Highlights, Latest, More Stories, All News)
//    - Non-News categories (Sports/Politics/etc) show ONLY in Category sections
// ✅ Still keeps Sources filtering (by category + selected sources)
// ✅ Auto-refresh merges newest items on top (1 min + tab-return refresh)
// ✅ “time ago” updates every 60s + on refresh
// ==============================
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  useMediaQuery,
  Collapse,
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import { useTheme } from "@mui/material/styles";

import { fetchFeedItems, fetchFeedSources } from "@/app/lib/api";
import { NewsItem, NewsSource } from "@/app/types/news";

import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";
import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import FourUpRow from "@/app/components/news/FourUpRow";
import TopSideBar from "@/app/components/news/TopSidebar";
import CategoryLanes from "@/app/components/news/CategoryLanes";
import FilteredNewsGrid from "@/app/components/news/FilteredNewsGrid";
import TimeAgo from "@/app/components/common/TimeAgo";

const REFRESH_MS = 60 * 1000;
const MIN_GAP_MS = 8 * 1000;

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

/**
 * SourcesPanel unchanged (kept as-is)
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [allItems, setAllItems] = useState<NewsItem[]>((items ?? []).filter(Boolean));
  const [allSources, setAllSources] = useState<NewsSource[]>(
    (sources ?? []).filter(Boolean).filter((s) => s.isActive !== false)
  );

  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [sourceCategory, setSourceCategory] = useState<string>("All");

  // ✅ Global sections are ALWAYS News-only
  const GLOBAL_CATEGORY = "News";

  // keep UI chip + menu style, but locked to "News"
  const [breakingCategory] = useState<string>(GLOBAL_CATEGORY);
  const [breakingAnchor, setBreakingAnchor] = useState<null | HTMLElement>(null);

  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [openItem, setOpenItem] = useState<NewsItem | null>(null);

  // ✅ Force “time ago” updates (every 60s + on refresh)
  const [nowTick, setNowTick] = useState<number>(() => Date.now());

  // ✅ Auto-refresh guards
  const lastRefreshAtRef = useRef<number>(0);
  const refreshingRef = useRef<boolean>(false);

  // ✅ Mobile related collapsible
  const [mobileRelatedOpen, setMobileRelatedOpen] = useState(false);
  useEffect(() => {
    if (isMobile) setMobileRelatedOpen(false);
  }, [openItem?.id, openItem?.url, isMobile]);

  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const selectedSet = useMemo(() => new Set((selectedIds ?? []).map(String)), [selectedIds]);
  const isAllSources = selectedIds.length === 0;
  const isSingleSource = selectedIds.length === 1;

  // ✅ Sources-side category (in SourcesPanel) -> determines which source IDs are allowed
  const allowedSourceIdSet = useMemo(() => {
    if (sourceCategory === "All") return null;
    const set = new Set<string>();
    for (const s of allSources ?? []) {
      const cat = clean(s?.category) || "News";
      if (cat === sourceCategory) set.add(String(s?.id ?? ""));
    }
    return set;
  }, [allSources, sourceCategory]);

  // ✅ helper: category per sourceId (default to "News" to avoid hiding uncategorized sources)
  const getSrcCategory = (sourceId?: string | null) => {
    const c = clean(categoryBySourceId[String(sourceId ?? "")]);
    return c || "News";
  };

  const isGlobalNewsItem = (it: NewsItem) => getSrcCategory(it?.sourceId) === GLOBAL_CATEGORY;

  // ✅ Auto refresh (1 minute) + tab-return refresh
  useEffect(() => {
    let alive = true;

    async function refresh(force = false) {
      if (!alive) return;

      const now = Date.now();
      if (!force && now - lastRefreshAtRef.current < MIN_GAP_MS) return;
      if (refreshingRef.current) return;

      refreshingRef.current = true;
      lastRefreshAtRef.current = now;

      try {
        const [src, feed] = await Promise.all([
          fetchFeedSources().catch(() => null),
          fetchFeedItems({ page: 1, pageSize: 160 }).catch(() => []),
        ]);

        if (!alive) return;

        if (src) {
          setAllSources((src ?? []).filter(Boolean).filter((s) => s.isActive !== false));
        }

        setAllItems((prev) => mergeTop(prev ?? [], (feed ?? []).filter(Boolean)));

        // ✅ bump relative times
        setNowTick(Date.now());
      } finally {
        refreshingRef.current = false;
      }
    }

    refresh(true);

    const id = setInterval(() => {
      refresh(false);
    }, REFRESH_MS);

    const onVis = () => {
      if (document.visibilityState === "visible") {
        refresh(false);
      }
    };

    document.addEventListener("visibilitychange", onVis);

    return () => {
      alive = false;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

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

  // ✅ Step 1: apply Sources filters to items (sourceCategory + selectedIds)
  const itemsAfterSourceFilters = useMemo(() => {
    const list = (allItems ?? []).filter(Boolean);

    const inAllowedSourceCategory = (it: NewsItem) => {
      if (!allowedSourceIdSet) return true;
      const sid = clean(it?.sourceId);
      if (!sid) return false;
      return allowedSourceIdSet.has(String(sid));
    };

    if (isAllSources) return list.filter(inAllowedSourceCategory);

    return list.filter((it) => {
      const sid = clean(it?.sourceId);
      if (!sid) return false;
      if (!selectedSet.has(String(sid))) return false;
      return inAllowedSourceCategory(it);
    });
  }, [allItems, allowedSourceIdSet, isAllSources, selectedSet]);

  // ✅ Step 2: sort newest-first (all categories)
  const sortedAll = useMemo(() => {
    const list = [...itemsAfterSourceFilters];
    list.sort((a, b) => clean(b?.publishedAt).localeCompare(clean(a?.publishedAt)));
    return list;
  }, [itemsAfterSourceFilters]);

  // ✅ Global feed universe (News-only)
  const sortedNewsOnly = useMemo(() => {
    return sortedAll.filter((it) => isGlobalNewsItem(it));
  }, [sortedAll]);

  // ✅ Category lanes should show NON-News items (plus you can choose to also show News in lanes if you want)
  // Requirement: non-News must appear in category section even if new.
  // We'll prioritize lanes for non-News only (clean separation).
  const lanesItems = useMemo(() => {
    return sortedAll.filter((it) => getSrcCategory(it?.sourceId) !== GLOBAL_CATEGORY);
  }, [sortedAll]);

  // ✅ NOW every GLOBAL section uses sortedNewsOnly
  const breakingItems = useMemo(() => {
    const out: NewsItem[] = [];
    const seen = new Set<string>();
    for (const it of sortedNewsOnly) {
      const k = keyOf(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= 6) break;
    }
    return out;
  }, [sortedNewsOnly]);

  const highlightItems = useMemo(() => breakingItems.slice(0, 6), [breakingItems]);

  const latestItems = useMemo(() => {
    const out: NewsItem[] = [];
    const seen = new Set<string>();
    for (const it of sortedNewsOnly) {
      const k = keyOf(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= 7) break;
    }
    return out;
  }, [sortedNewsOnly]);

  const moreStories = useMemo(() => sortedNewsOnly.slice(6, 30), [sortedNewsOnly]);

  // ✅ All News grid initial items = News-only feed
  const allNewsInitial = useMemo(() => sortedNewsOnly, [sortedNewsOnly]);

  const emptySingleSource =
    isSingleSource &&
    itemsAfterSourceFilters.length > 0 &&
    sortedNewsOnly.length === 0 &&
    lanesItems.length === 0;

  const toggleSource = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(Array.from(next));
  };

  const clearSelection = () => setSelectedIds([]);

  const onOpen = (it?: NewsItem | null) => {
    if (!it) return;
    setOpenItem(it);
  };

  const closeModal = () => setOpenItem(null);

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

  const relatedVideos = useMemo(() => {
    if (!openItem) return [] as NewsItem[];

    const baseTitle = clean(openItem?.title);
    const baseTokens = tokenizeTitle(baseTitle);

    const baseUrl = clean(openItem?.url);
    const baseId = clean(openItem?.id);

    // ✅ related search stays within the same "News-only" universe (prevents sports/politics videos from mixing)
    const candidates = (sortedNewsOnly ?? [])
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
  }, [openItem, sortedNewsOnly]);

  // ✅ Article embed-block detection
  const articleIframeRef = useRef<HTMLIFrameElement | null>(null);
  const [articleEmbedBlocked, setArticleEmbedBlocked] = useState(false);
  const [articleIframeReady, setArticleIframeReady] = useState(false);

  useEffect(() => {
    setArticleEmbedBlocked(false);
    setArticleIframeReady(false);
  }, [openItem?.id, openItem?.url]);

  const isBlockedHref = (h: string) => {
    const s = String(h || "");
    return (
      s.startsWith("chrome-error://") ||
      s.includes("chromewebdata") ||
      s === "about:blank" ||
      s.startsWith("about:error") ||
      s.startsWith("edge-error://")
    );
  };

  const checkArticleBlocked = () => {
    const el = articleIframeRef.current;
    if (!el) return;

    try {
      const href = String(el.contentWindow?.location?.href || "");
      if (isBlockedHref(href)) {
        setArticleEmbedBlocked(true);
        setArticleIframeReady(false);
        return;
      }
    } catch {
      // ignore cross-origin
    }

    setArticleIframeReady(true);

    setTimeout(() => {
      const el2 = articleIframeRef.current;
      if (!el2) return;
      try {
        const href2 = String(el2.contentWindow?.location?.href || "");
        if (isBlockedHref(href2)) {
          setArticleEmbedBlocked(true);
          setArticleIframeReady(false);
        }
      } catch {
        // ignore
      }
    }, 250);
  };

  const openSources = () => setSourcesOpen(true);
  const closeSources = () => setSourcesOpen(false);

  const openBreakingMenu = (e: React.MouseEvent<HTMLElement>) => setBreakingAnchor(e.currentTarget);
  const closeBreakingMenu = () => setBreakingAnchor(null);

  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }} data-nowtick={nowTick}>
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
            {isAllSources ? "All sources" : `${selectedIds.length} selected`} · {GLOBAL_CATEGORY}
          </Typography>

          <Box sx={{ flex: 1 }} />

          <Button
            onClick={openSources}
            variant="contained"
            startIcon={<MenuIcon />}
            sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999, flexShrink: 0 }}
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
                  This selection currently has no items. Try another category or clear filters.
                </Typography>
              </Box>
            ) : (
              <>
                {/* Breaking header (locked to News) */}
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                  <Typography variant="h6" fontWeight={900} sx={{ lineHeight: 1 }}>
                    Breaking
                  </Typography>

                  <Chip
                    label={breakingCategory}
                    size="small"
                    variant="filled"
                    sx={{ fontWeight: 900, borderRadius: 999 }}
                  />

                  <Box sx={{ flex: 1 }} />

                  {/* keep icon/menu for UI consistency, but it only contains "News" */}
                  <IconButton
                    onClick={openBreakingMenu}
                    size="small"
                    aria-label="Category locked to News"
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
                    <MenuItem selected sx={{ fontWeight: 900 }}>
                      {GLOBAL_CATEGORY}
                    </MenuItem>
                  </Menu>
                </Box>

                <BreakingSlideshow items={breakingItems} onOpen={(it) => onOpen(it)} />

                <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                  Highlights
                </Typography>
                <NewsGridHighlights items={highlightItems} onOpen={(it) => onOpen(it)} />

                <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
                  <TopSideBar title="Latest" items={latestItems} onOpen={(it) => onOpen(it)} />
                </Box>

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
                  items={lanesItems}
                  getCategory={(sourceId?: string) => getSrcCategory(String(sourceId ?? ""))}
                  onOpen={(it) => onOpen(it)}
                />

                <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                  All News
                </Typography>
                <FilteredNewsGrid
                  selectedSourceIds={selectedIds}
                  initialItems={allNewsInitial}
                  pageSize={60}
                  selectedCategory={GLOBAL_CATEGORY}
                  getCategory={(sourceId) => getSrcCategory(String(sourceId ?? ""))}
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
      </Box>

      {/* ✅ Modal */}
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
          {!modalUrl ? (
            <Box sx={{ p: 3 }}>
              <Typography fontWeight={950} fontSize={16}>
                This item can’t be opened in the modal
              </Typography>

              <Box sx={{ mt: 2, display: "flex", gap: 1, flexWrap: "wrap" }}>
                {!!clean(openItem?.url) && (
                  <Button
                    variant="contained"
                    startIcon={<OpenInNewIcon />}
                    onClick={() => window.open(clean(openItem?.url)!, "_blank", "noopener,noreferrer")}
                    sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                  >
                    Open in new tab
                  </Button>
                )}
                <Button
                  variant="outlined"
                  onClick={closeModal}
                  sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
                >
                  Close
                </Button>
              </Box>
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

                {/* small screens related */}
          {/* small screens related (LIGHT GREY) */}
<Box
  sx={{
    display: { xs: "block", md: "none" },
    bgcolor: "#f5f7fb", // ✅ light grey
    borderTop: "1px solid",
    borderColor: "divider",
  }}
>
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
      color: "text.primary",
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
        sx={{
          border: "1px solid",
          borderColor: "divider",
          bgcolor: "common.white",
          "&:hover": { bgcolor: "grey.50" },
        }}
      >
        {mobileRelatedOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
      </IconButton>
    ) : null}
  </Box>

  <Collapse in={mobileRelatedOpen} timeout={200} unmountOnExit>
    <Box sx={{ px: 2, pb: 1.5 }}>
      {relatedVideos.length === 0 ? (
        <Typography variant="caption" sx={{ color: "text.secondary" }}>
          No related videos found for this title yet.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {relatedVideos.slice(0, 3).map((rv, i) => {
            const title = clean(rv?.title) || "Video";
            const src = clean(rv?.sourceName) || "Source";
            const thumb = pickThumb(rv);
            const openUrl = safeUrl(rv?.url);

            return (
              <Box
                key={clean(rv?.id) || clean(rv?.url) || `${i}`}
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
                  bgcolor: "common.white",
                  transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
                  "&:hover": { bgcolor: "grey.50", boxShadow: 2, transform: "translateY(-1px)" },
                  minWidth: 0,
                }}
              >
                <Avatar
                  src={thumb}
                  sx={{
                    width: 34,
                    height: 34,
                    flexShrink: 0,
                    bgcolor: "rgba(0,0,0,0.04)",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {(src[0] ?? "V").toUpperCase()}
                </Avatar>

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={950} fontSize={12} noWrap sx={{ color: "text.primary" }}>
                    {title}
                  </Typography>

                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25 }}>
                    <Typography variant="caption" noWrap sx={{ color: "text.secondary" }}>
                      {src}
                    </Typography>

                    <Box sx={{ flex: 1 }} />

                    {!!clean(rv?.publishedAt) && (
                      <TimeAgo
                        key={`${clean(rv?.id) || clean(rv?.url)}-${nowTick}`}
                        iso={rv?.publishedAt}
                        variant="caption"
                        sx={{ color: "text.secondary", fontWeight: 900 }}
                      />
                    )}
                  </Box>
                </Box>

                <IconButton
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!openUrl) return;
                    window.open(openUrl, "_blank", "noopener,noreferrer");
                  }}
                  size="small"
                  aria-label="Open in new tab"
                  sx={{
                    flexShrink: 0,
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "common.white",
                    "&:hover": { bgcolor: "grey.50" },
                  }}
                >
                  <OpenInNewIcon sx={{ fontSize: 18 }} />
                </IconButton>
              </Box>
            );
          })}
        </Box>
      )}
    </Box>
  </Collapse>
</Box>
              </Box>

              {/* desktop related */}
         <Box
  sx={{
    display: { xs: "none", md: "block" },
    bgcolor: "#1565C0",
    borderLeft: "1px solid",
    borderColor: "divider",
    height: "100%",
    color: "white",
    overflow: "hidden",
  }}
>
   <Box
  sx={{
    p: 2,
    bgcolor: "#f5f7fb", // ✅ light grey (no blue)
    height: "100%",
    overflow: "auto",
  }}
>
  <Typography fontWeight={950} sx={{ mb: 1, color: "text.primary" }}>
    Related videos
  </Typography>

  {relatedVideos.length === 0 ? (
    <Typography variant="caption" sx={{ color: "text.secondary" }}>
      No related videos found for this title yet.
    </Typography>
  ) : (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {relatedVideos.slice(0, 4).map((rv, i) => {
        const title = clean(rv?.title) || "Video";
        const src = clean(rv?.sourceName) || "Source";
        const thumb = pickThumb(rv);
        const openUrl = safeUrl(rv?.url);

        return (
          <Box
            key={clean(rv?.id) || clean(rv?.url) || `${i}`}
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
              bgcolor: "common.white",
              transition: "transform 120ms ease, box-shadow 120ms ease, background 120ms ease",
              "&:hover": {
                bgcolor: "grey.50",
                boxShadow: 2,
                transform: "translateY(-1px)",
              },
              minWidth: 0,
            }}
          >
            {/* Icon/Thumb */}
            <Avatar
              src={thumb}
              sx={{
                width: 38,
                height: 38,
                flexShrink: 0,
                bgcolor: "rgba(0,0,0,0.04)",
                border: "1px solid",
                borderColor: "divider",
              }}
            >
              {(src[0] ?? "V").toUpperCase()}
            </Avatar>

            {/* Title + meta */}
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                fontWeight={950}
                fontSize={13}
                noWrap
                sx={{
                  color: "text.primary", // ✅ always visible
                  lineHeight: 1.25,
                }}
                title={title}
              >
                {title}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mt: 0.25, minWidth: 0 }}>
                <Typography
                  variant="caption"
                  noWrap
                  sx={{ color: "text.secondary", minWidth: 0 }}
                  title={src}
                >
                  {src}
                </Typography>

                <Box sx={{ flex: 1 }} />

                {!!clean(rv?.publishedAt) && (
                  <TimeAgo
                    key={`${clean(rv?.id) || clean(rv?.url)}-${nowTick}`}
                    iso={rv?.publishedAt}
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 900, flexShrink: 0 }}
                  />
                )}
              </Box>
            </Box>

            {/* Open external */}
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                if (!openUrl) return;
                window.open(openUrl, "_blank", "noopener,noreferrer");
              }}
              size="small"
              aria-label="Open in new tab"
              sx={{
                flexShrink: 0,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "common.white",
                "&:hover": { bgcolor: "grey.50" },
              }}
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
            // ✅ ARTICLE branch
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
                }}
              >
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

              {articleEmbedBlocked ? (
                <Box
                  sx={{
                    flex: 1,
                    bgcolor: "common.white",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    p: 3,
                  }}
                >
                  <Button
                    onClick={() => window.open(modalUrl, "_blank", "noopener,noreferrer")}
                    variant="contained"
                    startIcon={<OpenInNewIcon />}
                    sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999, px: 3 }}
                  >
                    Open in new tab
                  </Button>
                </Box>
              ) : (
                <Box sx={{ position: "relative", flex: 1, bgcolor: "common.white" }}>
                  <Box
                    component="iframe"
                    ref={(node: HTMLIFrameElement | null) => {
                      articleIframeRef.current = node;
                    }}
                    src={modalUrl}
                    title="Article"
                    onLoad={() => {
                      checkArticleBlocked();
                    }}
                    onError={() => {
                      setArticleEmbedBlocked(true);
                      setArticleIframeReady(false);
                    }}
                    sx={{
                      width: "100%",
                      height: "100%",
                      border: 0,
                      bgcolor: "common.white",
                      visibility: articleIframeReady ? "visible" : "hidden",
                    }}
                  />

                  {!articleIframeReady && (
                    <Box sx={{ position: "absolute", inset: 0, bgcolor: "common.white" }} />
                  )}
                </Box>
              )}
            </Box>
          )}

          <Divider sx={{ display: { xs: "block", md: "none" } }} />
        </DialogContent>
      </Dialog>
    </Box>
  );
}
