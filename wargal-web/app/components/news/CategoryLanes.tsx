// ==============================
// File: wargal-web/app/components/news/CategoryLanes.tsx
// ✅ Category section ONLY (tabs)
// ✅ Add SOURCE filter (per category) in the top-right (your red rectangle)
// ✅ Add pagination when items > 24 (4 cols x 6 rows)
// ✅ No slideshow
// ==============================
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Avatar,
  Chip,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Pagination,
  SelectChangeEvent,
} from "@mui/material";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "../common/TimeAgo";

type Props = {
  items: NewsItem[];
  getCategory: (sourceId?: string) => string;
  onOpen: (item: NewsItem) => void;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}
function sameCat(a?: string | null, b?: string | null) {
  return clean(a).toLowerCase() === clean(b).toLowerCase();
}

const PAGE_SIZE = 24; // 4 columns x 6 rows

export default function CategoryLanes({ items, getCategory, onOpen }: Props) {
  if (!items?.length) return null;

  const { cats, groups, preferredKey } = useMemo(() => {
    const groups = new Map<string, NewsItem[]>();

    for (const it of items) {
      const raw = getCategory(it?.sourceId);
      const cat = clean(raw) || "General";
      const arr = groups.get(cat) ?? [];
      arr.push(it);
      groups.set(cat, arr);
    }

    const allCats = [...groups.keys()];
    const sportsKey =
      allCats.find((c) => sameCat(c, "sports")) ??
      allCats.find((c) => clean(c).toLowerCase().includes("sport")) ??
      null;

    const byVolume = [...groups.entries()]
      .sort((a, b) => b[1].length - a[1].length)
      .map(([cat]) => cat);

    const cats: string[] = [];
    if (sportsKey) cats.push(sportsKey);
    for (const c of byVolume) if (!cats.includes(c)) cats.push(c);

    const MAX_TABS = 8;
    const finalCats = cats.slice(0, MAX_TABS);

    return {
      cats: finalCats,
      groups,
      preferredKey: sportsKey ?? finalCats[0] ?? "General",
    };
  }, [items, getCategory]);

  const [activeCat, setActiveCat] = useState<string>(preferredKey);

  // ✅ per-category source filter state
  const [sourceFilterByCat, setSourceFilterByCat] = useState<Record<string, string>>({});
  // ✅ per-category page state
  const [pageByCat, setPageByCat] = useState<Record<string, number>>({});

  const activeSourceId = sourceFilterByCat[activeCat] ?? "ALL";
  const page = pageByCat[activeCat] ?? 1;

  // Keep activeCat valid if cats change
  useEffect(() => {
    if (!cats.length) return;
    if (!cats.includes(activeCat)) setActiveCat(preferredKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cats.join("|"), preferredKey]);

  // Reset page when category changes or source filter changes
  useEffect(() => {
    setPageByCat((prev) => ({ ...prev, [activeCat]: 1 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeCat, activeSourceId]);

  // Items in active category (sorted newest first)
  const activeCatItems = useMemo(() => {
    const list = groups.get(activeCat) ?? [];
    return [...list].sort((a, b) => clean(b.publishedAt).localeCompare(clean(a.publishedAt)));
  }, [groups, activeCat]);

  // Build sources list for active category (unique)
  const activeSources = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon?: string | null }>();

    for (const it of activeCatItems) {
      const id = clean(it?.sourceId);
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: clean(it?.sourceName) || "Source",
          icon: it?.sourceIconUrl ?? null,
        });
      }
    }

    // Sort by name for dropdown usability
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [activeCatItems]);

  // Apply source filter
  const filteredItems = useMemo(() => {
    if (activeSourceId === "ALL") return activeCatItems;
    return activeCatItems.filter((it) => clean(it.sourceId) === activeSourceId);
  }, [activeCatItems, activeSourceId]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  }, [filteredItems.length]);

  // Clamp page if list shrinks
  useEffect(() => {
    if (page > totalPages) {
      setPageByCat((prev) => ({ ...prev, [activeCat]: totalPages }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalPages, activeCat]);

  const pageItems = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredItems.slice(start, start + PAGE_SIZE);
  }, [filteredItems, page]);

  const onChangeSource = (e: SelectChangeEvent<string>) => {
    const v = String(e.target.value);
    setSourceFilterByCat((prev) => ({ ...prev, [activeCat]: v }));
  };

  const onChangePage = (_: any, value: number) => {
    setPageByCat((prev) => ({ ...prev, [activeCat]: value }));
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: { xs: 1, md: 2 },
        bgcolor: "common.white",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* Header + Tabs + Source filter (red rectangle area) */}
      <Box sx={{ px: 1.5, pt: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={950} sx={{ flex: 1 }}>
            Categories
          </Typography>

          {/* ✅ SOURCE FILTER (top-right) */}
          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel id="cat-source-filter-label">Source</InputLabel>
            <Select
              labelId="cat-source-filter-label"
              value={activeSourceId}
              label="Source"
              onChange={onChangeSource}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              <MenuItem value="ALL" sx={{ fontWeight: 900 }}>
                All sources
              </MenuItem>

              {activeSources.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
                    <Avatar src={s.icon ?? undefined} sx={{ width: 18, height: 18 }}>
                      {(s.name[0] ?? "S").toUpperCase()}
                    </Avatar>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 850 }}>
                      {s.name}
                    </Typography>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Tabs
          value={activeCat}
          onChange={(_, v) => setActiveCat(String(v))}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{
            mt: 0.75,
            minHeight: 42,
            "& .MuiTab-root": {
              textTransform: "none",
              fontWeight: 950,
              minHeight: 42,
              px: 1.5,
            },
          }}
        >
          {cats.map((c) => (
            <Tab key={c} value={c} label={c} />
          ))}
        </Tabs>
      </Box>

      {/* Grid */}
      <Box
        sx={{
          p: 1.25,
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            md: "repeat(4, minmax(0, 1fr))",
          },
        }}
      >
        {pageItems.map((it) => {
          const thumb = clean(it.imageUrl) ? it.imageUrl! : "/placeholder-news.jpg";
          const source = clean(it.sourceName) || "Source";

          return (
            <Box
              key={it.id}
              onClick={() => onOpen(it)}
              sx={{
                cursor: "pointer",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "common.white",
                overflow: "hidden",
                "&:hover": { boxShadow: 1, bgcolor: "grey.50" },
                minWidth: 0,
              }}
            >
              <Box
                component="img"
                src={thumb}
                alt={it.title}
                sx={{
                  width: "100%",
                  height: 110,
                  objectFit: "cover",
                  display: "block",
                  bgcolor: "grey.100",
                }}
              />

              <Box sx={{ p: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight={950}
                  lineHeight={1.2}
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    minHeight: 34,
                  }}
                >
                  {it.title}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, minWidth: 0 }}>
                  <Avatar src={it.sourceIconUrl ?? undefined} sx={{ width: 18, height: 18 }}>
                    {(source[0] ?? "S").toUpperCase()}
                  </Avatar>

                  <Typography variant="caption" color="text.secondary" noWrap sx={{ minWidth: 0, flex: 1 }}>
                    {source}
                  </Typography>

                  <TimeAgo iso={it.publishedAt} variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }} />

                  {it.kind === 2 && <Chip label="Video" size="small" color="error" />}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Pagination (only if more than 24 items) */}
      {filteredItems.length > PAGE_SIZE ? (
        <Box
          sx={{
            px: 1.5,
            pb: 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 850 }}>
            Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, filteredItems.length)} of{" "}
            {filteredItems.length}
          </Typography>

          <Pagination
            count={totalPages}
            page={page}
            onChange={onChangePage}
            shape="rounded"
            size="small"
            siblingCount={1}
            boundaryCount={1}
          />
        </Box>
      ) : null}
    </Box>
  );
}