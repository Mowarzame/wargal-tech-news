"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";

import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";
import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import { fetchFeedItems } from "@/app/lib/api";
import { NewsItem } from "@/app/types/news";

export default function BreakingClientPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onOpen = (it: NewsItem) => {
    const url = (it.url ?? "").trim();
    if (!url.startsWith("http")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        setLoading(true);
        const feed = await fetchFeedItems({
          page: 1,
          pageSize: 60,
        });
        if (alive) setItems(feed);
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load breaking news");
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  // ✅ ISO string sort (no Date objects)
  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const ap = (a.publishedAt ?? "").trim();
      const bp = (b.publishedAt ?? "").trim();
      // Newest first (ISO sorts lexicographically)
      return bp.localeCompare(ap);
    });
  }, [items]);

  // 🔥 Breaking items (latest, unique by url) — do NOT require image
  const breakingItems = useMemo(() => {
    const seen = new Set<string>();
    return sorted
      .filter((it) => {
        const url = it.url?.trim();
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      })
      .slice(0, 6);
  }, [sorted]);

  // ⭐ Highlights (3×2) — unique by url, do NOT require image
  const highlights = useMemo(() => {
    const seen = new Set<string>();
    return sorted
      .filter((it) => {
        const url = it.url?.trim();
        if (!url || seen.has(url)) return false;
        seen.add(url);
        return true;
      })
      .slice(0, 6);
  }, [sorted]);

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, minHeight: "100vh", bgcolor: "#f5f7fb" }}>
      <Typography variant="h5" fontWeight={900} mb={2} color="primary.main">
        Breaking
      </Typography>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {!loading && error && (
        <Typography color="error.main">{error}</Typography>
      )}

      {!loading && !error && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <BreakingSlideshow items={breakingItems} onOpen={onOpen} />

          <Box>
            <Typography variant="h6" fontWeight={900} mb={1}>
              Highlights
            </Typography>

            <NewsGridHighlights items={highlights} onOpen={onOpen} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
