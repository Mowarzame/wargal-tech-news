"use client";

import { Box, Typography, Avatar, Chip } from "@mui/material";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  items: NewsItem[];
  onOpen: (item: NewsItem) => void;
};

export default function NewsGridHighlights({ items, onOpen }: Props) {
  if (!items?.length) return null;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))", // ✅ always 3 columns
        gap: { xs: 1, sm: 1.5, md: 2 },
      }}
    >
      {items.slice(0, 6).map((item) => {
        const image =
          item.imageUrl && item.imageUrl.trim()
            ? item.imageUrl
            : "/placeholder-news.jpg";

        const sourceIcon =
          item.sourceIconUrl && item.sourceIconUrl.trim()
            ? item.sourceIconUrl
            : undefined;

        const isVideo = item.kind === 2;

        return (
          <Box
            key={item.id}
            onClick={() => onOpen(item)}
            sx={{
              cursor: "pointer",
              position: "relative",
              borderRadius: 2,
              overflow: "hidden",
              boxShadow: 2,
              bgcolor: "grey.100",

              // ✅ Make tiles bigger on mobile (16/9 is too short for 3 cols)
              //    This matches what your screenshot needs.
              aspectRatio: { xs: "4 / 3", sm: "16 / 10", md: "16 / 9" },

              "&:hover img": { transform: "scale(1.05)" },
            }}
          >
            {/* background image */}
            <Box
              component="img"
              src={image}
              alt={item.title}
              sx={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transition: "transform 0.3s",
                display: "block",
              }}
            />

            {/* overlay */}
            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,.82), rgba(0,0,0,.10))",
                p: { xs: 1, sm: 1.25, md: 1.5 },
                display: "flex",
                flexDirection: "column",
                justifyContent: "flex-end",
                gap: 0.6,
              }}
            >
              {/* title */}
              <Typography
                sx={{
                  color: "common.white",
                  fontWeight: 900,
                  lineHeight: 1.15,

                  // ✅ readable on 3-col mobile
                  fontSize: { xs: 11.5, sm: 12.5, md: 14 },

                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: { xs: 2, md: 2 },
                  overflow: "hidden",
                  textShadow: "0 2px 10px rgba(0,0,0,.35)",
                }}
              >
                {item.title}
              </Typography>

              {/* bottom row */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.8,
                  minWidth: 0,
                }}
              >
                <Avatar
                  src={sourceIcon}
                  sx={{
                    width: { xs: 18, sm: 20, md: 22 },
                    height: { xs: 18, sm: 20, md: 22 },
                    flex: "0 0 auto",
                  }}
                >
                  {!sourceIcon && item.sourceName?.[0]}
                </Avatar>

                <Typography
                  sx={{
                    color: "rgba(255,255,255,.88)",
                    fontWeight: 800,
                    fontSize: { xs: 9.5, sm: 10.5, md: 11 },
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {item.sourceName}
                </Typography>

                {/* push right */}
                <Box sx={{ flex: 1 }} />

                {/* ✅ time ago (white, compact) */}
                <Box
                  sx={{
                    color: "rgba(255,255,255,.88)",
                    fontSize: { xs: 9.5, sm: 10.5, md: 11 },
                    lineHeight: 1,
                    flex: "0 0 auto",
                  }}
                >
                  {/* if your TimeAgo doesn't accept props, it still inherits this color if it uses Typography/span */}
                  <TimeAgo iso={item.publishedAt} />
                </Box>

                {/* ✅ tiny badge */}
                {isVideo && (
                  <Chip
                    label="Video"
                    size="small"
                    color="error"
                    sx={{
                      height: 18,
                      ml: 0.25,
                      "& .MuiChip-label": {
                        px: 0.6,
                        fontSize: 9.5,
                        fontWeight: 900,
                      },
                    }}
                  />
                )}
              </Box>
            </Box>
          </Box>
        );
      })}
    </Box>
  );
}
