"use client";

import { useEffect, useMemo, useState } from "react";
import { Box, Typography, IconButton, Avatar, Fade, Stack, Chip } from "@mui/material";
import ArrowBackIosNewIcon from "@mui/icons-material/ArrowBackIosNew";
import ArrowForwardIosIcon from "@mui/icons-material/ArrowForwardIos";
import FlashOnIcon from "@mui/icons-material/FlashOn";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  items: NewsItem[];
  onOpen: (item: NewsItem) => void;
  intervalMs?: number;
};

export default function BreakingSlideshow({ items, onOpen, intervalMs = 6000 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;

    const id = setInterval(() => {
      setIndex((i) => (i + 1) % items.length);
    }, intervalMs);

    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  useEffect(() => {
    // keep index valid when items change
    if (index >= items.length) setIndex(0);
  }, [items.length, index]);

  if (!items?.length) return null;

  const item = items[index];

  const image =
    item.imageUrl && item.imageUrl.trim().length > 0 ? item.imageUrl : "/placeholder-news.jpg";

  const sourceIcon =
    item.sourceIconUrl && item.sourceIconUrl.trim().length > 0 ? item.sourceIconUrl : undefined;

  const isVideo = item.kind === 2;

  // for Fade key stability even if id repeats in feed
  const fadeKey = useMemo(() => `${item.id}:${index}`, [item.id, index]);

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: 3,
        overflow: "hidden",
        bgcolor: "common.white",
        boxShadow: 1,
      }}
    >
      <Fade key={fadeKey} in timeout={450}>
        <Box
          onClick={() => onOpen(item)}
          sx={{
            cursor: "pointer",
            height: { xs: 220, sm: 260, md: 320 }, // ✅ responsive
            backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0) 35%, rgba(0,0,0,.78)), url(${image})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
            p: { xs: 1.5, sm: 2, md: 2.5 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1, flexWrap: "wrap" }}>
            <FlashOnIcon sx={{ color: "error.main" }} />
            <Typography variant="caption" fontWeight={900} color="error.main">
              BREAKING
            </Typography>

            {isVideo && (
              <Chip
                label="YouTube"
                color="error"
                size="small"
                sx={{
                  height: 22,
                  "& .MuiChip-label": { fontWeight: 900, fontSize: 11, px: 1 },
                }}
              />
            )}

            <Box sx={{ flex: 1 }} />

            {/* time ago in white */}
            <Box sx={{ color: "rgba(255,255,255,.9)", fontSize: { xs: 12, md: 13 } }}>
            <TimeAgo
              iso={item?.publishedAt}
            variant="caption"
           color="grey.300"
              sx={{ display: "block", lineHeight: 1.1 }}
           />
            </Box>
          </Stack>

          <Typography
            sx={{
              color: "common.white",
              fontWeight: 950,
              lineHeight: 1.1,
              // ✅ responsive title sizing
              fontSize: { xs: 18, sm: 22, md: 28, lg: 32 },
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: { xs: 3, sm: 3, md: 2 },
              overflow: "hidden",
              mb: { xs: 1, md: 1.25 },
              textShadow: "0 2px 10px rgba(0,0,0,.35)",
            }}
          >
            {item.title}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1}>
            <Avatar src={sourceIcon} sx={{ width: 26, height: 26 }}>
              {!sourceIcon && item.sourceName?.[0]}
            </Avatar>
            <Typography
              sx={{
                color: "rgba(255,255,255,.85)",
                fontWeight: 900,
                fontSize: { xs: 12, md: 13 },
                maxWidth: "70%",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.sourceName}
            </Typography>
          </Stack>
        </Box>
      </Fade>

      {/* Arrows */}
      {items.length > 1 && (
        <>
          <IconButton
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            sx={{
              position: "absolute",
              top: "50%",
              left: 10,
              transform: "translateY(-50%)",
              bgcolor: "rgba(255,255,255,.88)",
              "&:hover": { bgcolor: "rgba(255,255,255,.95)" },
            }}
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            sx={{
              position: "absolute",
              top: "50%",
              right: 10,
              transform: "translateY(-50%)",
              bgcolor: "rgba(255,255,255,.88)",
              "&:hover": { bgcolor: "rgba(255,255,255,.95)" },
            }}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>
        </>
      )}
    </Box>
  );
}
