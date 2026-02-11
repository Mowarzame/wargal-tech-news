"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";
import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import { fetchFeedItems } from "@/app/lib/api";
import { NewsItem } from "@/app/types/news";

const REFRESH_MS = 2 * 60 * 1000;

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function safeUrl(u?: string | null) {
  const url = clean(u);
  return url.startsWith("http") ? url : "";
}

export default function BreakingClientPage() {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<NewsItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const onOpen = (it?: NewsItem) => {
    const url = safeUrl(it?.url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  // ✅ refresh + merge (dedupe by url then id)
  useEffect(() => {
    let alive = true;

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

      // new first so you see latest without resetting
      for (const it of next ?? []) add(it);
      for (const it of prev ?? []) add(it);

      return out;
    };

    async function load(isFirst = false) {
      try {
        if (isFirst) setLoading(true);
        const feed = await fetchFeedItems({ page: 1, pageSize: 60 });
        if (!alive) return;
        setItems((prev) => mergeTop(prev, feed));
        setError(null);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message ?? "Failed to load breaking news");
      } finally {
        if (alive && isFirst) setLoading(false);
      }
    }

    load(true);
    const id = setInterval(() => load(false), REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const safe = useMemo(() => (items ?? []).filter(Boolean), [items]);

  const sorted = useMemo(() => {
    return [...safe].sort((a, b) => clean(b?.publishedAt).localeCompare(clean(a?.publishedAt)));
  }, [safe]);

  const breakingItems = useMemo(() => {
    const seen = new Set<string>();
    const out: NewsItem[] = [];
    for (const it of sorted) {
      if (!it) continue;
      const u = clean(it.url);
      const k = u ? `u:${u}` : `id:${clean(it.id)}`;
      if (!k || seen.has(k)) continue;
      seen.add(k);
      out.push(it);
      if (out.length >= 6) break;
    }
    return out;
  }, [sorted]);

  const highlights = useMemo(() => breakingItems.slice(0, 6), [breakingItems]);

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

      {!loading && error && <Typography color="error.main">{error}</Typography>}

      {!loading && !error && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <BreakingSlideshow items={breakingItems} onOpen={(it) => onOpen(it)} />
          <Box>
            <Typography variant="h6" fontWeight={900} mb={1}>
              Highlights
            </Typography>
            <NewsGridHighlights items={highlights} onOpen={(it) => onOpen(it)} />
          </Box>
        </Box>
      )}
    </Box>
  );
}
