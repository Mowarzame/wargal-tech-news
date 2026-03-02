"use client";

import { Box, Typography, Avatar, Stack, Chip } from "@mui/material";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";
import AiBadge from "../ai/AiBadge";

type Props = {
  items: NewsItem[];
  onOpen: (item: NewsItem) => void;

  // ✅ NEW: enforce ForeignNews for videos
  getCategory?: (sourceId?: string | null) => string;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function pickImage(it: NewsItem) {
  const img = clean(it.imageUrl);
  if (img) return img;

  const icon = clean(it.sourceIconUrl);
  if (icon) return icon;

  return "/placeholder-news.jpg";
}

function canShowAiBadge(it: NewsItem, getCategory?: (sourceId?: string | null) => string) {
  const kind = it?.kind;

  if (kind === 1) return !!clean((it as any)?.summary);

  if (kind === 2) {
    const sid = clean((it as any)?.sourceId);
    const cat =
      (getCategory ? clean(getCategory(sid)) : "") ||
      clean((it as any)?.sourceCategory);

    return cat === "ForeignNews";
  }

  return false;
}

export default function FourUpRow({ items, onOpen, getCategory }: Props) {
  const slice = items.slice(0, 4);
  if (!slice.length) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
        gap: 2,
      }}
    >
      {slice.map((item) => {
        const image = pickImage(item);
        const showAi = canShowAiBadge(item, getCategory);

        return (
          <Box
            key={item.id}
            onClick={() => onOpen(item)}
            sx={{
              cursor: "pointer",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: 1,
              "&:hover": { boxShadow: 3 },
              bgcolor: "common.white",
              border: "1px solid",
              borderColor: "divider",
              position: "relative",
            }}
          >
            <Box
              component="img"
              src={image}
              alt={item.title}
              sx={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
            />

            {/* ✅ AI badge ONLY when AI is allowed */}
            {showAi ? <AiBadge /> : null}

            <Box sx={{ p: 1.5 }}>
              <Typography
                variant="body2"
                fontWeight={900}
                lineHeight={1.25}
                sx={{
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  minHeight: 36,
                }}
              >
                {item.title}
              </Typography>

              <Stack direction="row" spacing={1} alignItems="center" mt={1} sx={{ minWidth: 0 }}>
                <Avatar src={clean(item.sourceIconUrl) ? item.sourceIconUrl! : undefined} sx={{ width: 22, height: 22 }}>
                  {(item.sourceName?.[0] ?? "S").toUpperCase()}
                </Avatar>

                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }} noWrap>
                  {item.sourceName}
                </Typography>

                <Box sx={{ flex: 1 }} />

                <TimeAgo
                  iso={item.publishedAt}
                  variant="caption"
                  sx={{ color: "text.secondary", fontWeight: 900, whiteSpace: "nowrap", fontSize: { xs: 11, md: 12 } }}
                />

                {item.kind === 2 && <Chip label="Video" size="small" color="error" />}
              </Stack>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}