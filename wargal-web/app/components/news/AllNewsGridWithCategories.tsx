"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography, Avatar } from "@mui/material";
import { NewsItem } from "@/app/types/news";
import { fetchFeedItems } from "@/app/lib/api";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  initialItems: NewsItem[];
  pageSize?: number;
  insertAfter?: number;
  insert: React.ReactNode;
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

  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const s = new Set<string>();
    for (const it of items) {
      const u = (it.url ?? "").trim();
      s.add(u ? `u:${u}` : `id:${it.id}`);
    }
    seenRef.current = s;
  }, [items]);

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

      <NewsGrid items={firstChunk} onOpen={onOpen} />

      <Box sx={{ my: 3 }}>{insert}</Box>

      {/* ✅ More Stories (time ago included + readable) */}
      <NewsGrid items={restChunk} onOpen={onOpen} />

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
          md: "repeat(3, minmax(0, 1fr))",
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
              "&:hover": { boxShadow: 3, borderColor: "rgba(0,0,0,.18)" },
            }}
          >
            <Box
              sx={{
                height: 170,
                bgcolor: "grey.100",
                backgroundImage: img ? `url(${img})` : "none",
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            />

            <Box sx={{ p: 1.25 }}>
              <Typography
                fontWeight={950}
                lineHeight={1.2}
                sx={{
                  mb: 0.75,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  minHeight: 44,
                }}
              >
                {it.title}
              </Typography>

              <Box sx={{ display: "flex", alignItems: "center", gap: 1, minWidth: 0 }}>
                <Avatar src={icon ? icon : undefined} sx={{ width: 20, height: 20 }}>
                  {(it.sourceName?.[0] ?? "S").toUpperCase()}
                </Avatar>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  noWrap
                  sx={{ flex: 1, minWidth: 0, fontWeight: 800 }}
                >
                  {it.sourceName}
                </Typography>

                {/* ✅ always visible */}
                <TimeAgo
                  iso={it.publishedAt}
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 900 }}
                />
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
