"use client";

import { Box, Typography, Avatar, Chip } from "@mui/material";
import PlayCircleFilledWhiteIcon from "@mui/icons-material/PlayCircleFilledWhite";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  items: NewsItem[] | null | undefined;
  onOpen: (item: NewsItem) => void;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function pickImage(it?: NewsItem | null) {
  const img = clean(it?.imageUrl);
  if (img) return img;

  const icon = clean(it?.sourceIconUrl);
  if (icon) return icon;

  return "/placeholder-news.jpg";
}

export default function NewsGridHighlights({ items, onOpen }: Props) {
  const list = (items ?? []).filter(Boolean);
  if (!list.length) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: { xs: 1, sm: 1.5, md: 2 },
      }}
    >
      {list.slice(0, 6).map((item) => {
        const image = pickImage(item);
        const sourceIcon = clean(item?.sourceIconUrl) ? item!.sourceIconUrl! : undefined;
        const isVideo = item?.kind === 2;

        return (
          <Box
            key={clean(item?.id) || `${image}-${Math.random()}`}
            onClick={() => item && onOpen(item)}
            sx={{
              cursor: "pointer",
              position: "relative",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: 2,
              bgcolor: "grey.100",
              aspectRatio: { xs: "4 / 3", sm: "16 / 10", md: "16 / 9" },
              "&:hover img": { transform: "scale(1.05)" },
            }}
          >
            <Box
              component="img"
              src={image}
              alt={clean(item?.title) || "News"}
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
                background: "linear-gradient(to top, rgba(0,0,0,.85), rgba(0,0,0,.08))",
                p: { xs: 1, sm: 1.25, md: 1.5 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 0.6,
              }}
            >
              <Typography
                sx={{
                  color: "common.white",
                  fontWeight: 900,
                  lineHeight: 1.15,
                  fontSize: { xs: 11.5, sm: 12.5, md: 14 },
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  textShadow: "0 2px 10px rgba(0,0,0,.35)",
                }}
              >
                {clean(item?.title) || "(Untitled)"}
              </Typography>



<Box sx={{ display: "flex", alignItems: "center", gap: 0.8, minWidth: 0 }}>
  {/* ✅ Always show responsive source icon (mobile + desktop) */}
  <Avatar
    src={sourceIcon}
    alt={clean(item?.sourceName) || "Source"}
    sx={{
      width: { xs: 18, sm: 20, md: 22 },
      height: { xs: 18, sm: 20, md: 22 },
      bgcolor: "rgba(255,255,255,.25)",
      border: "1px solid rgba(255,255,255,.35)",
      flex: "0 0 auto",
    }}
  >
    {!sourceIcon && clean(item?.sourceName)?.[0]}
  </Avatar>

  {/* Desktop: keep showing source name (UI remains same) */}
  <Typography
    sx={{
      display: { xs: "none", md: "block" },
      color: "rgba(255,255,255,.88)",
      fontWeight: 850,
      fontSize: 11,
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
      minWidth: 0,
    }}
  >
    {clean(item?.sourceName) || "Source"}
  </Typography>

  <Box sx={{ flex: 1 }} />

  <TimeAgo
    iso={item?.publishedAt}
    variant="caption"
    sx={{ color: "rgba(255,255,255,.92)", fontWeight: 900, fontSize: { xs: 10, md: 11 } }}
  />

  {isVideo && (
    <>
      <PlayCircleFilledWhiteIcon
        sx={{
          display: { xs: "block", md: "none" },
          fontSize: 16,
          color: "white",
          opacity: 0.95,
          flex: "0 0 auto",
        }}
      />
      <Chip
        label="Video"
        size="small"
        color="error"
        sx={{
          display: { xs: "none", md: "inline-flex" },
          height: 18,
          ml: 0.25,
          "& .MuiChip-label": { px: 0.6, fontSize: 9.5, fontWeight: 900 },
        }}
      />
    </>
  )}
</Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
