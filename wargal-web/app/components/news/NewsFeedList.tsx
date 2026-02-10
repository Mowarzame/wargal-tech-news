"use client";

import * as React from "react";
import { NewsItem } from "@/app/types/news";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardMedia from "@mui/material/CardMedia";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import TimeAgo from "@/app/components/common/TimeAgo";

type Props = {
  items: NewsItem[];
  onOpen: (it: NewsItem) => void;
};

export default function NewsFeedList({ items, onOpen }: Props) {
  if (!items?.length) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">No items yet</Typography>
      </Box>
    );
  }

  return (
    <Stack spacing={1.5} sx={{ p: 0 }}>
      {items.map((it) => {
        const img =
          it.imageUrl && it.imageUrl.trim().length > 0 ? it.imageUrl : undefined;

        const icon =
          it.sourceIconUrl && it.sourceIconUrl.trim().length > 0
            ? it.sourceIconUrl
            : undefined;

        return (
          <Card
            key={it.id}
            variant="outlined"
            sx={{
              borderRadius: 2,
              overflow: "hidden",
              cursor: "pointer",
              transition: "0.15s",
              "&:hover": { boxShadow: 2, borderColor: "rgba(0,0,0,.18)" },
            }}
            onClick={() => onOpen(it)}
          >
            <Box sx={{ display: "flex" }}>
              {img ? (
                <CardMedia
                  component="img"
                  image={img}
                  alt={it.title}
                  sx={{ width: 150, height: 112, objectFit: "cover" }}
                />
              ) : (
                <Box sx={{ width: 150, height: 112, bgcolor: "grey.100" }} />
              )}

              <CardContent sx={{ flex: 1, py: 1.2 }}>
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.6,
                    minWidth: 0,
                  }}
                >
                  <Avatar src={icon} sx={{ width: 22, height: 22 }}>
                    {(it.sourceName?.[0] ?? "S").toUpperCase()}
                  </Avatar>

                  <Typography variant="body2" fontWeight={900} noWrap>
                    {it.sourceName}
                  </Typography>

                  {it.kind === 2 && (
                    <Chip
                      label="Video"
                      size="small"
                      color="error"
                      sx={{ height: 20 }}
                    />
                  )}

                  <Box sx={{ flex: 1 }} />

                  {/* ✅ visible on all sizes */}
                  <TimeAgo
                    iso={it.publishedAt}
                    variant="caption"
                    sx={{ color: "text.secondary", fontWeight: 800 }}
                  />
                </Box>

                <Typography
                  variant="subtitle1"
                  fontWeight={950}
                  sx={{
                    lineHeight: 1.2,
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {it.title}
                </Typography>
              </CardContent>
            </Box>
          </Card>
        );
      })}
    </Stack>
  );
}
