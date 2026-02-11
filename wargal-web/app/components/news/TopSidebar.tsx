"use client";

import { Box, Typography, Stack, Avatar, Divider } from "@mui/material";
import { NewsItem } from "@/app/types/news";

type Props = {
  title: string;
  items: NewsItem[] | null | undefined;
  onOpen: (it: NewsItem) => void;
};

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function pickThumb(it?: NewsItem | null) {
  const img = clean(it?.imageUrl);
  if (img) return img;

  const icon = clean(it?.sourceIconUrl);
  if (icon) return icon;

  return ""; // sidebar allows empty
}

function timeAgoFromIso(iso?: string | null) {
  const s = clean(iso);
  if (!s) return "";

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";

  const diffMs = Date.now() - dt.getTime();
  if (diffMs < 0) return "just now";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;

  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

export default function TopSideBar({ title, items, onOpen }: Props) {
  const list = (items ?? []).filter(Boolean);
  if (!list.length) return null;

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      <Box sx={{ px: 2, py: 1.5 }}>
        <Typography fontWeight={900}>{title}</Typography>
      </Box>

      <Divider />

      <Stack spacing={0} sx={{ py: 0.5 }}>
        {list.map((it, idx) => {
          const thumb = pickThumb(it);
          const sourceIcon = clean(it?.sourceIconUrl);
          const ago = timeAgoFromIso(it?.publishedAt);

          return (
            <Box key={clean(it?.id) || `${idx}`}>
              <Box
                onClick={() => it && onOpen(it)}
                sx={{
                  cursor: "pointer",
                  px: 2,
                  py: 1.25,
                  display: "flex",
                  gap: 1.25,
                  alignItems: "flex-start",
                  "&:hover": { bgcolor: "grey.50" },
                }}
              >
                <Box
                  sx={{
                    width: 54,
                    height: 54,
                    borderRadius: 1.5,
                    bgcolor: "grey.100",
                    border: "1px solid",
                    borderColor: "divider",
                    backgroundImage: thumb ? `url(${thumb})` : "none",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    flexShrink: 0,
                  }}
                />

                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography
                    fontWeight={800}
                    fontSize={13}
                    lineHeight={1.25}
                    sx={{
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {clean(it?.title) || "(Untitled)"}
                  </Typography>

                  <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75, minWidth: 0 }}>
                    <Avatar
                      src={sourceIcon ? sourceIcon : undefined}
                      sx={{ width: 18, height: 18 }}
                    >
                      {(clean(it?.sourceName)?.[0] ?? "S").toUpperCase()}
                    </Avatar>

                    <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                      {clean(it?.sourceName) || "Source"}
                    </Typography>

                    {it?.kind === 2 && (
                      <Box
                        sx={{
                          px: 0.8,
                          py: 0.2,
                          borderRadius: 999,
                          bgcolor: "error.main",
                          color: "common.white",
                          fontSize: 11,
                          fontWeight: 900,
                          flexShrink: 0,
                        }}
                      >
                        Video
                      </Box>
                    )}
                  </Stack>

                  {!!ago && (
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
                      {ago}
                    </Typography>
                  )}
                </Box>
              </Box>

              {idx !== list.length - 1 && <Divider />}
            </Box>
          );
        })}
      </Stack>
    </Box>
  );
}
