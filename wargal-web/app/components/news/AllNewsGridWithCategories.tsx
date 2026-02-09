"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography, Avatar } from "@mui/material";
import { NewsItem } from "@/app/types/news";
import { fetchFeedItems } from "@/app/lib/api";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  initialItems: NewsItem[];
  pageSize?: number;                 // default 60
  insertAfter?: number;              // default 9 (3 rows x 3 cols)
  insert: React.ReactNode;           // CategoryLanes block
  onOpen: (it: NewsItem) => void;
};

export default function AllNewsGridWithCategories({
  initialItems,
  pageSize = 60,
  insertAfter = 9,
  insert,
  onOpen,
}: Props) {
  const [items, setItems] = useState<NewsItem[]>(initialItems ?? []);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // ✅ rebuild dedupe set whenever items change
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const s = new Set<string>();
    for (const it of items) {
      const u = (it.url ?? "").trim();
      s.add(u ? `u:${u}` : `id:${it.id}`);
    }
    seenRef.current = s;
  }, [items]);

  // ✅ if initialItems changes (server refresh), reset
  useEffect(() => {
    setItems(initialItems ?? []);
    setPage(1);
    setError(null);
    setHasMore(true);
  }, [initialItems]);

  const firstChunk = useMemo(() => items.slice(0, insertAfter), [items, insertAfter]);
  const restChunk = useMemo(() => items.slice(insertAfter), [items, insertAfter]);

  const loadMore = async () => {
    if (!hasMore || loadingMore) return;

    setLoadingMore(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const fetched = await fetchFeedItems({ page: nextPage, pageSize });

      // dedupe by url then id
      const toAdd: NewsItem[] = [];
      for (const it of fetched) {
        const u = (it.url ?? "").trim();
        const k = u ? `u:${u}` : `id:${it.id}`;
        if (seenRef.current.has(k)) continue;
        seenRef.current.add(k);
        toAdd.push(it);
      }

      setItems((prev) => [...prev, ...toAdd]);
      setPage(nextPage);

      if (fetched.length < pageSize) setHasMore(false);
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

      {/* ✅ First 3 rows (9 items) */}
      <NewsGrid items={firstChunk} onOpen={onOpen} />

      {/* ✅ Insert categories in the middle */}
      <Box sx={{ my: 3 }}>{insert}</Box>

      {/* ✅ Resume all news */}
      <NewsGrid items={restChunk} onOpen={onOpen} />

      {/* ✅ Load more stays at the bottom */}
      <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
        <Button
          variant="contained"
          onClick={loadMore}
          disabled={loadingMore || !hasMore}
          sx={{ borderRadius: 2, minWidth: 180 }}
        >
          {loadingMore ? (
            <CircularProgress size={20} sx={{ color: "common.white" }} />
          ) : hasMore ? (
            "Load more"
          ) : (
            "No more"
          )}
        </Button>
      </Box>
    </Box>
  );
}

function NewsGrid({ items, onOpen }: { items: NewsItem[]; onOpen: (it: NewsItem) => void }) {
  if (!items.length) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr",
          sm: "repeat(2, minmax(0, 1fr))",
          md: "repeat(3, minmax(0, 1fr))", // ✅ 3 columns like you requested
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
              <Typography fontWeight={900} lineHeight={1.2} sx={{ mb: 0.75 }}>
                {it.title}
              </Typography>

       
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Avatar src={icon ? icon : undefined} sx={{ width: 20, height: 20 }}>
                  {(it.sourceName?.[0] ?? "S").toUpperCase()}
                </Avatar>

                <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {it.sourceName}
                </Typography>

                {/* ✅ time ago */}
                <TimeAgo iso={it.publishedAt} variant="caption" color="text.secondary" />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
