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
            sx={{ borderRadius: 2, overflow: "hidden", cursor: "pointer" }}
            onClick={() => onOpen(it)}
          >
            <Box sx={{ display: "flex" }}>
              {/* image (optional) */}
              {img ? (
                <CardMedia
                  component="img"
                  image={img}
                  alt={it.title}
                  sx={{ width: 140, height: 110, objectFit: "cover" }}
                />
              ) : (
                <Box sx={{ width: 140, height: 110, bgcolor: "grey.100" }} />
              )}

              <CardContent sx={{ flex: 1, py: 1.2 }}>
                {/* meta row */}
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    mb: 0.5,
                  }}
                >
                  <Avatar src={icon} sx={{ width: 22, height: 22 }}>
                    {(it.sourceName?.[0] ?? "S").toUpperCase()}
                  </Avatar>

                  <Typography variant="body2" fontWeight={800} noWrap>
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

                  {/* time ago */}
                  <TimeAgo iso={it.publishedAt} />
                </Box>

                {/* title only */}
                <Typography
                  variant="subtitle1"
                  fontWeight={900}
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

                {/* ✅ summary removed بالكامل */}
              </CardContent>
            </Box>
          </Card>
        );
      })}
    </Stack>
  );
}
