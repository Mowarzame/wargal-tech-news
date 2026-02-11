"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { NewsItem } from "@/app/types/news";
import { fetchFeedItems } from "@/app/lib/api";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  selectedSourceIds: string[]; // empty => all
  initialItems: NewsItem[];
  pageSize?: number;
  columns?: { xs: number; sm: number; md: number; lg: number };
};

const REFRESH_MS = 2 * 60 * 1000;

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function safeUrl(u?: string | null) {
  const url = clean(u);
  return url.startsWith("http") ? url : "";
}

function pickImage(it?: NewsItem) {
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
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
}: Props) {
  const [items, setItems] = useState<NewsItem[]>((initialItems ?? []).filter(Boolean));
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const selectedSet = useMemo(() => new Set((selectedSourceIds ?? []).map(String)), [selectedSourceIds]);
  const isAll = (selectedSourceIds ?? []).length === 0;
  const isSingle = (selectedSourceIds ?? []).length === 1;

  // ✅ Reset local list on selection change (safe)
  useEffect(() => {
    setItems((initialItems ?? []).filter(Boolean));
    setPage(1);
    setError(null);
    setHasMore(true);
  }, [initialItems, selectedSourceIds.join("|")]);

  // ✅ Dedupe set
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const s = new Set<string>();
    for (const it of items ?? []) {
      if (!it) continue;
      const u = clean(it.url);
      const k = u ? `u:${u}` : `id:${clean(it.id)}`;
      if (k) s.add(k);
    }
    seenRef.current = s;
  }, [items]);

  const onOpen = (it?: NewsItem) => {
    const url = safeUrl(it?.url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const filterForMulti = (arr: NewsItem[]) => {
    if (isAll || isSingle) return arr;
    return (arr ?? []).filter((it) => it?.sourceId && selectedSet.has(String(it.sourceId)));
  };

  const mergeTop = (prev: NewsItem[], next: NewsItem[]) => {
    const out: NewsItem[] = [];
    const seen = new Set<string>();

    const add = (it: NewsItem) => {
      if (!it) return;
      const u = clean(it.url);
      const k = u ? `u:${u}` : `id:${clean(it.id)}`;
      if (!k || seen.has(k)) return;
      seen.add(k);
      out.push(it);
    };

    for (const it of next ?? []) add(it);
    for (const it of prev ?? []) add(it);

    return out;
  };

  // ✅ Auto refresh every 2 minutes (page 1) and merge into top
  useEffect(() => {
    let alive = true;

    async function refresh() {
      try {
        setRefreshing(true);
        const fetched = await fetchFeedItems({
          page: 1,
          pageSize,
          sourceId: isSingle ? selectedSourceIds[0] : undefined,
        });

        const filtered = filterForMulti((fetched ?? []).filter(Boolean));
        if (!alive) return;

        setItems((prev) => mergeTop(prev ?? [], filtered));
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to refresh news");
      } finally {
        if (alive) setRefreshing(false);
      }
    }

    refresh();
    const id = setInterval(refresh, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [selectedSourceIds.join("|"), pageSize]);

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;

      const fetched = await fetchFeedItems({
        page: nextPage,
        pageSize,
        sourceId: isSingle ? selectedSourceIds[0] : undefined,
      });

      const filtered = filterForMulti((fetched ?? []).filter(Boolean));

      const toAdd: NewsItem[] = [];
      for (const it of filtered) {
        if (!it) continue;
        const u = clean(it.url);
        const k = u ? `u:${u}` : `id:${clean(it.id)}`;
        if (!k || seenRef.current.has(k)) continue;
        seenRef.current.add(k);
        toAdd.push(it);
      }

      setItems((prev) => [...(prev ?? []), ...toAdd]);
      setPage(nextPage);

      if ((fetched ?? []).length < pageSize) setHasMore(false);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more news");
    } finally {
      setLoadingMore(false);
    }
  };

  const list = (items ?? []).filter(Boolean);

  return (
    <Box>
      {!!error && (
        <Typography color="error.main" sx={{ mb: 1 }}>
          {error}
        </Typography>
      )}

      {refreshing && (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>
          Updating…
        </Typography>
      )}

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: `repeat(${columns.xs}, minmax(0, 1fr))`,
            sm: `repeat(${columns.sm}, minmax(0, 1fr))`,
            md: `repeat(${columns.md}, minmax(0, 1fr))`,
            lg: `repeat(${columns.lg}, minmax(0, 1fr))`,
          },
          gap: 2,
        }}
      >
        {list.map((it) => {
          const img = pickImage(it);
          const icon = clean(it?.sourceIconUrl);

          return (
            <Box
              key={clean(it?.id) || `${img}-${Math.random()}`}
              onClick={() => onOpen(it)}
              sx={{
                cursor: "pointer",
                borderRadius: 2,
                overflow: "hidden",
                bgcolor: "background.paper",
                border: "1px solid",
                borderColor: "divider",
                transition: "0.15s",
                "&:hover": { boxShadow: 3 },
              }}
            >
              <Box
                sx={{
                  height: 160,
                  bgcolor: "grey.100",
                  backgroundImage: `url(${img})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              <Box sx={{ p: 1.25 }}>
                <Typography fontWeight={900} lineHeight={1.2} sx={{ mb: 0.75 }}>
                  {clean(it?.title) || "(Untitled)"}
                </Typography>

                {!!clean(it?.summary) && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
                    {clean(it?.summary)}
                  </Typography>
                )}

                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  <Box
                    sx={{
                      width: 18,
                      height: 18,
                      borderRadius: "50%",
                      bgcolor: "grey.200",
                      backgroundImage: icon ? `url(${icon})` : "none",
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                      flexShrink: 0,
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                    {clean(it?.sourceName) || "Source"}
                  </Typography>

                  <Box sx={{ flex: 1 }} />

                  <TimeAgo iso={it?.publishedAt} variant="caption" color="text.secondary" />

                  {it?.kind === 2 && (
                    <Box
                      sx={{
                        px: 1,
                        py: 0.25,
                        borderRadius: 999,
                        bgcolor: "error.main",
                        color: "common.white",
                        fontSize: 11,
                        fontWeight: 900,
                        flexShrink: 0,
                      }}
                    >
                      Video
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <Button
          variant="contained"
          onClick={loadMore}
          disabled={loadingMore || !hasMore}
          sx={{ borderRadius: 2, minWidth: 180 }}
        >
          {loadingMore ? <CircularProgress size={20} sx={{ color: "common.white" }} /> : hasMore ? "Load more" : "No more"}
        </Button>
      </Box>
    </Box>
  );
}
