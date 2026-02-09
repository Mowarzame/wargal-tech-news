"use client";

import { useMemo, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Typography,
} from "@mui/material";
import { NewsItem } from "@/app/types/news";
import { fetchFeedItems } from "@/app/lib/api";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  initialItems: NewsItem[];
  pageSize?: number;
};

export default function AllNewsSection({ initialItems, pageSize = 30 }: Props) {
  const [items, setItems] = useState<NewsItem[]>(initialItems ?? []);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onOpen = (it: NewsItem) => {
    const url = (it.url ?? "").trim();
    if (!url.startsWith("http")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const keyOf = (it: NewsItem) => {
    const u = (it.url ?? "").trim();
    return u ? `u:${u}` : `id:${it.id}`;
  };

  const deduped = useMemo(() => {
    const seen = new Set<string>();
    const out: NewsItem[] = [];
    for (const it of items) {
      const k = keyOf(it);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(it);
    }
    return out;
  }, [items]);

  async function loadMore() {
    if (loading) return;
    setLoading(true);
    setError(null);

    try {
      const nextPage = page + 1;
      const more = await fetchFeedItems({ page: nextPage, pageSize });
      setItems((prev) => [...prev, ...more]);
      setPage(nextPage);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load more news");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      {/* ✅ 3-col grid (responsive) */}
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
        {deduped.map((it) => {
          const image =
            it.imageUrl && it.imageUrl.trim() ? it.imageUrl : "/placeholder-news.jpg";

          const sourceIcon =
            it.sourceIconUrl && it.sourceIconUrl.trim()
              ? it.sourceIconUrl
              : undefined;

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
                component="img"
                src={image}
                alt={it.title}
                sx={{
                  width: "100%",
                  height: 160,
                  objectFit: "cover",
                  display: "block",
                }}
              />

              {/* content */}
              <Box sx={{ p: 1.25 }}>
                {/* title only */}
                <Typography
                  fontWeight={900}
                  sx={{
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 42, // keeps cards aligned
                  }}
                >
                  {it.title}
                </Typography>

                {/* meta row */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mt: 1,
                  }}
                >
                  <Avatar src={sourceIcon} sx={{ width: 20, height: 20 }}>
                    {!sourceIcon && (it.sourceName?.[0] ?? "S")}
                  </Avatar>

                  <Typography variant="caption" color="text.secondary" noWrap>
                    {it.sourceName}
                  </Typography>

                  <Box sx={{ flex: 1 }} />

                  {/* time ago */}
                  <TimeAgo iso={it.publishedAt} />

                  {it.kind === 2 && (
                    <Chip
                      label="Video"
                      size="small"
                      color="error"
                      sx={{ height: 20, ml: 0.5 }}
                    />
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Load more */}
      <Box sx={{ mt: 2, display: "flex", flexDirection: "column", gap: 1 }}>
        {error && (
          <Typography color="error.main" variant="body2">
            {error}
          </Typography>
        )}

        <Button
          variant="contained"
          onClick={loadMore}
          disabled={loading}
          sx={{ alignSelf: "center", minWidth: 180 }}
        >
          {loading ? (
            <>
              <CircularProgress size={18} sx={{ mr: 1 }} />
              Loading…
            </>
          ) : (
            "Load more"
          )}
        </Button>
      </Box>
    </Box>
  );
}
