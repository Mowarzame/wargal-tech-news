"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { NewsItem } from "@/app/types/news";
import { fetchFeedItems } from "@/app/lib/api";
import { Box, Card, CardContent, CardMedia, Typography, Avatar, Stack, Button , CircularProgress} from "@mui/material";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  selectedSourceIds: string[]; // empty => all
  initialItems: NewsItem[];
  pageSize?: number; // default 60
  columns?: { xs: number; sm: number; md: number; lg: number }; // default 1/2/3/4
};

export default function FilteredNewsGrid({
  selectedSourceIds,
  initialItems,
  pageSize = 60,
  columns = { xs: 1, sm: 2, md: 3, lg: 4 },
}: Props) {
  const [items, setItems] = useState<NewsItem[]>(initialItems ?? []);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  const selectedSet = useMemo(() => new Set(selectedSourceIds.map(String)), [selectedSourceIds]);
  const isAll = selectedSourceIds.length === 0;
  const isSingle = selectedSourceIds.length === 1;

  // ✅ reset local state when selection changes (important!)
  useEffect(() => {
    setItems(initialItems ?? []);
    setPage(1);
    setError(null);
    setHasMore(true);
  }, [initialItems, selectedSourceIds.join("|")]);

  // ✅ dedupe helper (stable)
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const s = new Set<string>();
    for (const it of items) {
      const u = (it.url ?? "").trim();
      s.add(u ? `u:${u}` : `id:${it.id}`);
    }
    seenRef.current = s;
  }, [items]);

  const onOpen = (it: NewsItem) => {
    const url = (it.url ?? "").trim();
    if (!url.startsWith("http")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const loadMore = async () => {
    if (loadingMore || !hasMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;

      // ✅ Single-source: fetch server-filtered
      // ✅ Multi/all: fetch global page and filter client-side (Flutter approach)
      const fetched = await fetchFeedItems({
        page: nextPage,
        pageSize,
        sourceId: isSingle ? selectedSourceIds[0] : undefined,
      });

      // filter for multi-select (or all => keep)
      const filtered = (isAll || isSingle)
        ? fetched
        : fetched.filter((it) => it.sourceId && selectedSet.has(String(it.sourceId)));

      // dedupe
      const toAdd: NewsItem[] = [];
      for (const it of filtered) {
        const u = (it.url ?? "").trim();
        const k = u ? `u:${u}` : `id:${it.id}`;
        if (seenRef.current.has(k)) continue;
        seenRef.current.add(k);
        toAdd.push(it);
      }

      setItems((prev) => [...prev, ...toAdd]);
      setPage(nextPage);

      // heuristic: if backend returns less than pageSize, probably no more pages
      if (fetched.length < pageSize) setHasMore(false);
      // if we fetched but after filtering got none, we still might have more in later pages
      // so we do NOT set hasMore=false on filtered empty.
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more news");
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <Box>
      {!!error && (
        <Typography color="error.main" sx={{ mb: 1 }}>
          {error}
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
        {items.map((it) => {
          const img = (it.imageUrl ?? "").trim();
          const icon = (it.sourceIconUrl ?? "").trim();

          return (
            <Box
              key={it.id}
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
              {/* image */}
              <Box
                sx={{
                  height: 160,
                  bgcolor: "grey.100",
                  backgroundImage: img ? `url(${img})` : "none",
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />

              <Box sx={{ p: 1.25 }}>
                <Typography fontWeight={900} lineHeight={1.2} sx={{ mb: 0.75 }} noWrap>
                  {it.title}
                </Typography>

                {!!it.summary && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }} noWrap>
                    {it.summary}
                  </Typography>
                )}

                <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                  {/* source icon */}
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
                    {it.sourceName}
                  </Typography>

                  <Box sx={{ flex: 1 }} />
  <TimeAgo iso={it.publishedAt} variant="caption" color="text.secondary" />

                  {it.kind === 2 && (
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

                {/* keep string; no Date parsing to avoid SSR hydration issues */}
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.75, display: "block" }}>
                  {it.publishedAt}
                </Typography>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* load more */}
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
