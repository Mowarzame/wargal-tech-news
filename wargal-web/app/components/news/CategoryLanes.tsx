"use client";

import { Box, Typography, Stack, Avatar, Chip } from "@mui/material";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "../common/TimeAgo";

type Props = {
  items: NewsItem[];
  getCategory: (sourceId?: string) => string;
  onOpen: (item: NewsItem) => void;
};

export default function CategoryLanes({ items, getCategory, onOpen }: Props) {
  if (!items.length) return null;

  // Group by category
  const groups = new Map<string, NewsItem[]>();
  for (const it of items) {
    const catRaw = getCategory(it.sourceId);
    const cat = (catRaw ?? "General").trim() || "General";
    const arr = groups.get(cat) ?? [];
    arr.push(it);
    groups.set(cat, arr);
  }

  const allCats = [...groups.keys()];

  // Always include Sports if present (case-insensitive)
  const sportsKey =
    allCats.find((c) => c.toLowerCase() === "sports") ??
    allCats.find((c) => c.toLowerCase().includes("sport"));

  // Fill remaining by volume (deterministic)
  const byVolume = [...groups.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([cat]) => cat);

  const selected: string[] = [];
  if (sportsKey) selected.push(sportsKey);

  for (const cat of byVolume) {
    if (selected.length >= 3) break;
    if (selected.includes(cat)) continue;
    selected.push(cat);
  }

  const lanes = selected.map((cat) => ({
    title: cat,
    items: (groups.get(cat) ?? []).slice(0, 7), // 1 featured + 6 rows
  }));

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
        gap: 2,
      }}
    >
      {lanes.map((lane) => (
        <CategoryLane
          key={lane.title}
          title={lane.title}
          items={lane.items}
          onOpen={onOpen}
        />
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

  const featured = items[0];
  const rest = items.slice(1);

  const featuredImage =
    featured.imageUrl && featured.imageUrl.trim()
      ? featured.imageUrl
      : "/placeholder-news.jpg";

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: 1,
        bgcolor: "common.white",
      }}
    >
      <Box sx={{ p: 1.5, borderBottom: "1px solid", borderColor: "divider" }}>
        <Typography variant="subtitle1" fontWeight={900}>
          {title}
        </Typography>
      </Box>

      {/* Featured */}
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
            transition: "transform 0.3s",
            display: "block",
          }}
        />
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(to top, rgba(0,0,0,.75), rgba(0,0,0,.2))",
            p: 2,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <Typography color="common.white" fontWeight={800} lineHeight={1.2}>
            {featured.title}
          </Typography>

          <Stack direction="row" spacing={1} alignItems="center" mt={1}>
            <Avatar
              src={featured.sourceIconUrl ?? undefined}
              sx={{ width: 22, height: 22 }}
            >
              {(featured.sourceName?.[0] ?? "S").toUpperCase()}
            </Avatar>
            <Typography variant="caption" color="grey.200">
              {featured.sourceName}
            </Typography>
            {featured.kind === 2 && (
              <Chip label="Video" size="small" color="error" />
            )}
          </Stack>
        </Box>
      </Box>

      {/* Rows with thumbnails */}
      <Stack spacing={0} sx={{ p: 1 }}>
        {rest.map((it) => {
          const thumb =
            it.imageUrl && it.imageUrl.trim()
              ? it.imageUrl
              : "/placeholder-news.jpg";

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
                  width: 48,
                  height: 48,
                  borderRadius: 1,
                  objectFit: "cover",
                  flexShrink: 0,
                  bgcolor: "grey.100",
                }}
              />

              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography
                  variant="body2"
                  fontWeight={700}
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

                   <TimeAgo iso={it.publishedAt} variant="caption" color="text.secondary" />
                  {it.kind === 2 && (
                    <Chip label="Video" size="small" color="error" />
                  )}
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
