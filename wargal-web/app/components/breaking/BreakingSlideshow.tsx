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

function clean(s?: string | null) {
  return (s ?? "").trim();
}

export default function BreakingSlideshow({ items, onOpen, intervalMs = 6500 }: Props) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % items.length), intervalMs);
    return () => clearInterval(id);
  }, [items.length, intervalMs]);

  useEffect(() => {
    if (index >= items.length) setIndex(0);
  }, [index, items.length]);

  if (!items?.length) return null;

  const item = items[index];
  const image = clean(item.imageUrl) ? item.imageUrl! : "/placeholder-news.jpg";
  const sourceIcon = clean(item.sourceIconUrl) ? item.sourceIconUrl! : undefined;
  const isVideo = item.kind === 2;

  const fadeKey = useMemo(() => `${item.id}:${index}`, [item.id, index]);

  return (
    <Box
      sx={{
        position: "relative",
        borderRadius: { xs: 2, md: 3 },
        overflow: "hidden",
        bgcolor: "common.white",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: { xs: 1, md: 2 },
        width: "100%",
      }}
    >
      <Fade key={fadeKey} in timeout={320}>
        <Box
          onClick={() => onOpen(item)}
          sx={{
            cursor: "pointer",
            height: { xs: 320, sm: 380, md: 460, lg: 540 },
            backgroundImage: `
              linear-gradient(to top, rgba(0,0,0,.90) 0%, rgba(0,0,0,.45) 42%, rgba(0,0,0,.10) 80%),
              url(${image})
            `,
            backgroundSize: "cover",
            backgroundPosition: "center",
            // ✅ reserve space so dots NEVER overlap the source row
            pb: { xs: 7, sm: 7, md: 7 },
            px: { xs: 1.5, sm: 2.25, md: 3 },
            pt: { xs: 1.5, sm: 2.25, md: 3 },
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
          }}
        >
          {/* Bottom content area only (safe zone) */}
          <Typography
            sx={{
              color: "common.white",
              fontWeight: 950,
              lineHeight: 1.08,
              fontSize: { xs: 19, sm: 28, md: 38, lg: 44 },
              display: "-webkit-box",
              WebkitBoxOrient: "vertical",
              WebkitLineClamp: { xs: 3, sm: 2, md: 2 },
              overflow: "hidden",
              mb: { xs: 1.1, md: 1.4 },
              textShadow: "0 2px 18px rgba(0,0,0,.55)",
              maxWidth: { xs: "100%", md: "92%" },
            }}
          >
            {item.title}
          </Typography>

          <Stack direction="row" alignItems="center" spacing={1} sx={{ minWidth: 0 }}>
            <Avatar
              src={sourceIcon}
              sx={{
                width: { xs: 24, md: 30 },
                height: { xs: 24, md: 30 },
                bgcolor: "rgba(255,255,255,.22)",
                border: "1px solid rgba(255,255,255,.28)",
                flex: "0 0 auto",
              }}
            >
              {!sourceIcon && item.sourceName?.[0]}
            </Avatar>

            <Typography
              sx={{
                color: "rgba(255,255,255,.92)",
                fontWeight: 900,
                fontSize: { xs: 12, md: 13.5 },
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                textShadow: "0 2px 10px rgba(0,0,0,.45)",
                minWidth: 0,
                flex: 1,
              }}
            >
              {item.sourceName}
            </Typography>
          </Stack>
        </Box>
      </Fade>

      {/* ✅ Top-left badges (separate from title area => no mixing) */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 10, md: 14 },
          left: { xs: 10, md: 14 },
          zIndex: 10,
          display: "flex",
          alignItems: "center",
          gap: 1,
          px: 1.1,
          py: 0.7,
          borderRadius: 999,
          bgcolor: "rgba(0,0,0,.35)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,.18)",
        }}
      >
        <FlashOnIcon sx={{ color: "error.main", fontSize: 18 }} />
        <Typography
          variant="caption"
          sx={{ color: "error.main", fontWeight: 950, letterSpacing: 0.6 }}
        >
          BREAKING
        </Typography>
        {isVideo && (
          <Chip
            label="YouTube"
            color="error"
            size="small"
            sx={{
              height: 20,
              "& .MuiChip-label": { fontWeight: 900, fontSize: 10.5, px: 0.8 },
            }}
          />
        )}
      </Box>

      {/* ✅ Top-right time pill */}
      <Box
        sx={{
          position: "absolute",
          top: { xs: 10, md: 14 },
          right: { xs: 10, md: 14 },
          zIndex: 10,
          px: 1.1,
          py: 0.7,
          borderRadius: 999,
          bgcolor: "rgba(0,0,0,.35)",
          backdropFilter: "blur(8px)",
          border: "1px solid rgba(255,255,255,.18)",
        }}
      >
        <TimeAgo
          iso={item.publishedAt}
          variant="caption"
          sx={{
            color: "rgba(255,255,255,.92)",
            fontWeight: 900,
            fontSize: { xs: 11, md: 12 },
          }}
        />
      </Box>

      {/* Arrows */}
      {items.length > 1 && (
        <>
          <IconButton
            onClick={() => setIndex((i) => (i - 1 + items.length) % items.length)}
            sx={{
              position: "absolute",
              top: { xs: "46%", md: "50%" }, // ✅ slightly higher on mobile
              left: { xs: 8, md: 14 },
              transform: "translateY(-50%)",
              bgcolor: "rgba(255,255,255,.92)",
              "&:hover": { bgcolor: "rgba(255,255,255,.98)" },
              boxShadow: 2,
              width: { xs: 38, md: 46 },
              height: { xs: 38, md: 46 },
              zIndex: 12,
            }}
          >
            <ArrowBackIosNewIcon fontSize="small" />
          </IconButton>

          <IconButton
            onClick={() => setIndex((i) => (i + 1) % items.length)}
            sx={{
              position: "absolute",
              top: { xs: "46%", md: "50%" },
              right: { xs: 8, md: 14 },
              transform: "translateY(-50%)",
              bgcolor: "rgba(255,255,255,.92)",
              "&:hover": { bgcolor: "rgba(255,255,255,.98)" },
              boxShadow: 2,
              width: { xs: 38, md: 46 },
              height: { xs: 38, md: 46 },
              zIndex: 12,
            }}
          >
            <ArrowForwardIosIcon fontSize="small" />
          </IconButton>

          {/* Dots (bottom center, safe) */}
          <Box
            sx={{
              position: "absolute",
              bottom: { xs: 10, md: 14 },
              left: "50%",
              transform: "translateX(-50%)",
              display: "flex",
              gap: 0.8,
              px: 1.2,
              py: 0.75,
              borderRadius: 999,
              bgcolor: "rgba(0,0,0,.25)",
              backdropFilter: "blur(6px)",
              zIndex: 12,
            }}
          >
            {items.slice(0, Math.min(items.length, 8)).map((_, i) => (
              <Box
                key={i}
                sx={{
                  width: i === index ? 14 : 7,
                  height: 7,
                  borderRadius: 99,
                  transition: "0.2s",
                  bgcolor: i === index ? "common.white" : "rgba(255,255,255,.55)",
                }}
              />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
