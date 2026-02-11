// ==============================
// File: wargal-web/app/components/Home/HomeShell.tsx
// ==============================
"use client";

import { useEffect, useMemo, useState } from "react";
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
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";

import { fetchFeedItems, fetchFeedSources } from "@/app/lib/api";
import { NewsItem, NewsSource } from "@/app/types/news";

import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";
import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import FourUpRow from "@/app/components/news/FourUpRow";
import TopSideBar from "@/app/components/news/TopSidebar";
import CategoryLanes from "@/app/components/news/CategoryLanes";
import FilteredNewsGrid from "@/app/components/news/FilteredNewsGrid";

const REFRESH_MS = 2 * 60 * 1000;

type Props = {
  items: NewsItem[];
  sources: NewsSource[];
  categoryBySourceId: Record<string, string>;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function safeUrl(u?: string | null) {
  const url = clean(u);
  return url.startsWith("http") ? url : "";
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
}) {
  return (
    <>
      {/* header (fixed inside card/drawer) */}
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

      {/* list (scroll) */}
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

  const [q, setQ] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]); // empty => all

  // ✅ Mobile sources drawer state
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const openSources = () => setSourcesOpen(true);
  const closeSources = () => setSourcesOpen(false);

  const selectedSet = useMemo(() => new Set((selectedIds ?? []).map(String)), [selectedIds]);
  const isAll = selectedIds.length === 0;
  const isSingle = selectedIds.length === 1;

  const onOpen = (it?: NewsItem | null) => {
    const url = safeUrl(it?.url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ✅ auto refresh every 2 mins (items + sources)
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

  const filteredSources = useMemo(() => {
    const query = clean(q).toLowerCase();
    const list = (allSources ?? []).filter(Boolean);

    if (!query) return list;
    return list.filter((s) => clean(s.name).toLowerCase().includes(query));
  }, [allSources, q]);

  const filteredItems = useMemo(() => {
    const list = (allItems ?? []).filter(Boolean);

    if (isAll) return list;

    return list.filter((it) => {
      const sid = clean(it?.sourceId);
      return sid && selectedSet.has(String(sid));
    });
  }, [allItems, isAll, selectedSet]);

  const sorted = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => clean(b?.publishedAt).localeCompare(clean(a?.publishedAt)));
    return list;
  }, [filteredItems]);

  const breakingItems = useMemo(() => {
    const out: NewsItem[] = [];
    const seen = new Set<string>();
    for (const it of sorted) {
      const k = keyOf(it);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= 6) break;
    }
    return out;
  }, [sorted]);

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

  const moreStories = useMemo(() => sorted.slice(6, 30), [sorted]);

  const emptySingleSource = isSingle && sorted.length === 0;

  const toggleSource = (id: string) => {
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(Array.from(next));
  };

  const clearSelection = () => setSelectedIds([]);

  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
        {/* ✅ Small UI only: row with selection count (left) + Sources button (right) */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            gap: 1,
            mb: 1.5,
          }}
        >
          <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0 }}>
            {isAll ? "All sources" : `${selectedIds.length} selected`}
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
          {/* ✅ drawer header keeps title ONCE */}
          <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
            <Typography fontWeight={950} sx={{ flex: 1 }}>
              Sources
            </Typography>

            <IconButton onClick={closeSources} aria-label="Close sources">
              <CloseIcon />
            </IconButton>
          </Box>

          <Divider />

          {/* ✅ showTitle=false removes the double Sources title */}
          <SourcesPanel
            q={q}
            setQ={setQ}
            isAll={isAll}
            selectedIds={selectedIds}
            clearSelection={clearSelection}
            filteredSources={filteredSources}
            selectedSet={selectedSet}
            toggleSource={toggleSource}
            showTitle={false}
          />
        </Drawer>

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
                isAll={isAll}
                selectedIds={selectedIds}
                clearSelection={clearSelection}
                filteredSources={filteredSources}
                selectedSet={selectedSet}
                toggleSource={toggleSource}
                showTitle={true}
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
                <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                  Breaking
                </Typography>
                <BreakingSlideshow items={breakingItems} onOpen={(it) => onOpen(it)} />

                <Typography variant="h6" fontWeight={900} sx={{ mt: 2, mb: 1 }}>
                  Highlights
                </Typography>
                <NewsGridHighlights items={highlightItems} onOpen={(it) => onOpen(it)} />

                {/* ✅ Small screen: Latest here */}
                <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
                  <TopSideBar title="Latest" items={latestItems} onOpen={(it) => onOpen(it)} />
                </Box>

                {/* ✅ Desktop: More Stories here */}
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
                  items={sorted}
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
                  initialItems={sorted.slice(0, 60)}
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

        {/* ✅ Small screen: More Stories moved to bottom */}
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
    </Box>
  );
}
