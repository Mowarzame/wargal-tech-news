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
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
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
              bgcolor: "grey.100",
              border: "1px solid rgba(0,0,0,.08)",
              boxShadow: { xs: 1, md: 2 },
              aspectRatio: { xs: "4 / 3", sm: "16 / 10", md: "16 / 9" },
              "&:hover img": { transform: "scale(1.05)" },
            }}
          >
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

            <Box
              sx={{
                position: "absolute",
                inset: 0,
                background:
                  "linear-gradient(to top, rgba(0,0,0,.88), rgba(0,0,0,.22))",
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
                  fontWeight: 950,
                  lineHeight: 1.15,
                  fontSize: { xs: 11.5, sm: 12.5, md: 14 },
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                  textShadow: "0 2px 14px rgba(0,0,0,.55)",
                }}
              >
                {item.title}
              </Typography>

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
                    bgcolor: "rgba(255,255,255,.22)",
                    border: "1px solid rgba(255,255,255,.25)",
                  }}
                >
                  {!sourceIcon && item.sourceName?.[0]}
                </Avatar>

                <Typography
                  sx={{
                    color: "rgba(255,255,255,.92)",
                    fontWeight: 850,
                    fontSize: { xs: 9.5, sm: 10.5, md: 11 },
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minWidth: 0,
                  }}
                >
                  {item.sourceName}
                </Typography>

                <Box sx={{ flex: 1 }} />

                {/* ✅ time ago white + visible always */}
                <TimeAgo
                  iso={item.publishedAt}
                  variant="caption"
                  sx={{
                    color: "rgba(255,255,255,.92)",
                    fontWeight: 800,
                    fontSize: { xs: 9.5, sm: 10.5, md: 11 },
                    textShadow: "0 2px 10px rgba(0,0,0,.55)",
                    lineHeight: 1,
                  }}
                />

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
                        fontWeight: 950,
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
