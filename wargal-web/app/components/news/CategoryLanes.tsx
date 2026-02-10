"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Typography, Stack, Avatar, Chip, IconButton } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
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

export default function CategoryLanes({ items, getCategory, onOpen }: Props) {
  if (!items.length) return null;

  const groups = new Map<string, NewsItem[]>();
  for (const it of items) {
    const catRaw = getCategory(it.sourceId);
    const cat = clean(catRaw) || "General";
    const arr = groups.get(cat) ?? [];
    arr.push(it);
    groups.set(cat, arr);
  }

  const allCats = [...groups.keys()];
  const sportsKey =
    allCats.find((c) => c.toLowerCase() === "sports") ??
    allCats.find((c) => c.toLowerCase().includes("sport"));

  const byVolume = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat]) => cat);

  const selected: string[] = [];
  if (sportsKey) selected.push(sportsKey);
  for (const cat of byVolume) {
    if (selected.length >= 3) break;
    if (!selected.includes(cat)) selected.push(cat);
  }

  const lanes = selected.map((cat) => ({
    title: cat,
    items: (groups.get(cat) ?? []).slice(0, 14),
  }));

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" }, gap: 2 }}>
      {lanes.map((lane) => (
        <CategoryLane key={lane.title} title={lane.title} items={lane.items} onOpen={onOpen} />
      ))}
    </Box>
  );
}

function CategoryLane({
  title,
  items,
  onOpen,
}: {
  title: string;
  items: NewsItem[];
  onOpen: (item: NewsItem) => void;
}) {
  if (!items.length) return null;

  // ✅ Pool for big slideshow ONLY
  const featuredPool = useMemo(() => {
    const withImg = items.filter((x) => clean(x.imageUrl).length > 0);
    const pool = (withImg.length ? withImg : items).slice(0, 5);
    return [...pool].sort((a, b) => clean(b.publishedAt).localeCompare(clean(a.publishedAt)));
  }, [items]);

  const poolIds = useMemo(() => new Set(featuredPool.map((x) => x.id)), [featuredPool]);

  // ✅ Rows MUST be static: do NOT depend on current slide
  const rows = useMemo(() => {
    // remove all pool items so rows never change when slideshow changes
    const rest = items.filter((x) => !poolIds.has(x.id));
    // if not enough, just take from after first item to keep stable
    const stable = rest.length ? rest : items.slice(1);
    return stable.slice(0, 6);
  }, [items, poolIds]);

  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (featuredPool.length <= 1) return;
    const id = setInterval(() => setIdx((i) => (i + 1) % featuredPool.length), 6500);
    return () => clearInterval(id);
  }, [featuredPool.length]);

  useEffect(() => {
    if (idx >= featuredPool.length) setIdx(0);
  }, [idx, featuredPool.length]);

  const featured = featuredPool[idx];
  const featuredImage = clean(featured.imageUrl) ? featured.imageUrl! : "/placeholder-news.jpg";

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
      <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1" fontWeight={950}>
          {title}
        </Typography>
      </Box>

      {/* ✅ ONLY the big item slides */}
      <Box
        onClick={() => onOpen(featured)}
        sx={{
          cursor: "pointer",
          position: "relative",
          aspectRatio: "16 / 9",
          overflow: "hidden",
          "&:hover img": { transform: "scale(1.05)" },
        }}
      >
        <Box
          component="img"
          src={featuredImage}
          alt={featured.title}
          sx={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transition: "transform 0.35s",
            display: "block",
          }}
        />

        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background: "linear-gradient(to top, rgba(0,0,0,.88), rgba(0,0,0,.18))",
            p: 2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            gap: 0.75,
          }}
        >
          <Typography
            color="common.white"
            fontWeight={950}
            lineHeight={1.2}
            sx={{
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
              textShadow: "0 2px 14px rgba(0,0,0,.55)",
            }}
          >
            {featured.title}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ minWidth: 0 }}>
            <Avatar
              src={featured.sourceIconUrl ?? undefined}
              sx={{
                width: 22,
                height: 22,
                bgcolor: "rgba(255,255,255,.22)",
                border: "1px solid rgba(255,255,255,.25)",
              }}
            >
              {(featured.sourceName?.[0] ?? "S").toUpperCase()}
            </Avatar>

            <Typography
              variant="caption"
              sx={{
                color: "rgba(255,255,255,.90)",
                fontWeight: 850,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {featured.sourceName}
            </Typography>

            <TimeAgo
              iso={featured.publishedAt}
              variant="caption"
              sx={{ color: "rgba(255,255,255,.92)", fontWeight: 900 }}
            />

            {featured.kind === 2 && <Chip label="Video" size="small" color="error" />}
          </Stack>
        </Box>

        {featuredPool.length > 1 && (
          <>
            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                setIdx((i) => (i - 1 + featuredPool.length) % featuredPool.length);
              }}
              sx={{
                position: "absolute",
                top: "50%",
                left: 8,
                transform: "translateY(-50%)",
                bgcolor: "rgba(255,255,255,.92)",
                "&:hover": { bgcolor: "rgba(255,255,255,.98)" },
                boxShadow: 2,
                width: 38,
                height: 38,
                zIndex: 3,
              }}
            >
              <ArrowBackIosNewIcon fontSize="small" />
            </IconButton>

            <IconButton
              onClick={(e) => {
                e.stopPropagation();
                setIdx((i) => (i + 1) % featuredPool.length);
              }}
              sx={{
                position: "absolute",
                top: "50%",
                right: 8,
                transform: "translateY(-50%)",
                bgcolor: "rgba(255,255,255,.92)",
                "&:hover": { bgcolor: "rgba(255,255,255,.98)" },
                boxShadow: 2,
                width: 38,
                height: 38,
                zIndex: 3,
              }}
            >
              <ArrowForwardIosIcon fontSize="small" />
            </IconButton>
          </>
        )}
      </Box>

      {/* ✅ Rows remain stable (no sliding) */}
      <Stack spacing={0} sx={{ p: 1 }}>
        {rows.map((it) => {
          const thumb = clean(it.imageUrl) ? it.imageUrl! : "/placeholder-news.jpg";
          return (
            <Box
              key={it.id}
              onClick={() => onOpen(it)}
              sx={{
                cursor: "pointer",
                p: 1,
                borderRadius: 1,
                "&:hover": { bgcolor: "grey.50" },
                display: "flex",
                gap: 1.25,
                alignItems: "flex-start",
              }}
            >
              <Box
                component="img"
                src={thumb}
                alt={it.title}
                sx={{
                  width: 50,
                  height: 50,
                  borderRadius: 1,
                  objectFit: "cover",
                  flexShrink: 0,
                  bgcolor: "grey.100",
                }}
              />

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight={850}
                  lineHeight={1.25}
                  sx={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {it.title}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" mt={0.5}>
                  <Typography variant="caption" color="text.secondary" noWrap>
                    {it.sourceName}
                  </Typography>
                  <TimeAgo iso={it.publishedAt} variant="caption" sx={{ color: "text.secondary", fontWeight: 900 }} />
                  {it.kind === 2 && <Chip label="Video" size="small" color="error" />}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
