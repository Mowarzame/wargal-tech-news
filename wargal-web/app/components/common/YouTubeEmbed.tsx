// ==============================
// File: wargal-web/app/components/common/YouTubeEmbed.tsx
// ✅ Safe YouTube embed from either youtube URL OR raw videoId
// ✅ Lazy loads via <iframe loading="lazy"> for performance
// ==============================

"use client";

import * as React from "react";
import { Box, Typography } from "@mui/material";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function extractYouTubeId(input?: string | null): string | null {
  const s = clean(input);
  if (!s) return null;

  // If user pasted only the id
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s;

  try {
    const url = new URL(s);

    // youtu.be/<id>
    if (url.hostname.includes("youtu.be")) {
      const id = clean(url.pathname.replace("/", ""));
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    // youtube.com/watch?v=<id>
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtube.com/embed/<id>
    const parts = url.pathname.split("/").filter(Boolean);
    const embedIdx = parts.findIndex((p) => p === "embed");
    if (embedIdx >= 0 && parts[embedIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[embedIdx + 1])) {
      return parts[embedIdx + 1];
    }

    // youtube.com/shorts/<id>
    const shortsIdx = parts.findIndex((p) => p === "shorts");
    if (shortsIdx >= 0 && parts[shortsIdx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[shortsIdx + 1])) {
      return parts[shortsIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

export default function YouTubeEmbed({
  urlOrId,
  title = "YouTube video",
}: {
  urlOrId?: string | null;
  title?: string;
}) {
  const id = React.useMemo(() => extractYouTubeId(urlOrId), [urlOrId]);

  if (!id) return null;

  const src = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1`;

  return (
    <Box sx={{ mt: 1.5 }}>
      <Box
        sx={{
          width: "100%",
          aspectRatio: "16 / 9",
          borderRadius: 2,
          border: "1px solid",
          borderColor: "divider",
          overflow: "hidden",
          bgcolor: "grey.100",
        }}
      >
        <Box
          component="iframe"
          src={src}
          title={title}
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          sx={{ width: "100%", height: "100%", border: 0, display: "block" }}
        />
      </Box>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block" }}>
        Video
      </Typography>
    </Box>
  );
}
