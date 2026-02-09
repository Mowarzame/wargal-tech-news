"use client";

import { useEffect, useState } from "react";
import { Box, Avatar, Typography, CircularProgress } from "@mui/material";
import { fetchFeedSources } from "@/app/lib/api";
import { NewsSource } from "@/app/types/news";

export default function TopSourcesBar() {
  const [sources, setSources] = useState<NewsSource[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const data = await fetchFeedSources();
        if (alive) {
          // Only active sources, stable order
          setSources(data.filter((s) => s.isActive));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ px: 2, py: 1 }}>
        <CircularProgress size={20} />
      </Box>
    );
  }

  if (!sources.length) return null;

  return (
    <Box
      sx={{
        display: "flex",
        gap: 2,
        overflowX: "auto",
        px: { xs: 1.5, md: 2 },
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        bgcolor: "background.paper",
        "&::-webkit-scrollbar": { display: "none" },
      }}
    >
      {sources.map((s) => (
        <SourceItem key={s.id} source={s} />
      ))}
    </Box>
  );
}

function SourceItem({ source }: { source: NewsSource }) {
  const onClick = () => {
    // For now: open source website (safe, simple)
    // Later: route to /source/[id]
    if (source.websiteUrl?.startsWith("http")) {
      window.open(source.websiteUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Box
      onClick={onClick}
      sx={{
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        gap: 1,
        px: 1.25,
        py: 0.75,
        borderRadius: 2,
        whiteSpace: "nowrap",
        bgcolor: "grey.50",
        "&:hover": { bgcolor: "grey.100" },
        flexShrink: 0,
      }}
    >
      <Avatar
        src={source.iconUrl ?? undefined}
        sx={{ width: 28, height: 28 }}
      >
        {source.name?.[0]}
      </Avatar>

      <Typography variant="body2" fontWeight={700}>
        {source.name}
      </Typography>
    </Box>
  );
}
