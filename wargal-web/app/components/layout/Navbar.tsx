"use client";

import * as React from "react";
import {
  AppBar,
  Avatar,
  Box,
  Toolbar,
  Typography,
} from "@mui/material";
import { fetchFeedSources } from "@/app/lib/api";
import { NewsSource } from "@/app/types/news";

export default function Navbar() {
  const [sources, setSources] = React.useState<NewsSource[]>([]);

  React.useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const list = await fetchFeedSources();
        if (!alive) return;

        const active = (list ?? [])
          .filter((s) => s.isActive)
          .sort((a, b) => (b.trustLevel ?? 0) - (a.trustLevel ?? 0));

        setSources(active);
      } catch {
        // ignore (navbar should not break)
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <AppBar position="sticky" elevation={0}>
      <Toolbar sx={{ minHeight: 64, gap: 2 }}>
        {/* Left: Logo + Name */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
    <Box
  component="img"
  src="/images/logo/correctLogo.png"
  alt="Wargal"
  sx={{
    width: 70,
    height: 70,
    borderRadius: 1,
  }}
/>

        </Box>

        {/* Center: scrolling icons (marquee) */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <SourcesMarquee sources={sources} />
        </Box>

        {/* Right: keep space for future actions */}
        <Box sx={{ width: 40 }} />
      </Toolbar>
    </AppBar>
  );
}

function SourcesMarquee({ sources }: { sources: NewsSource[] }) {
  // Duplicate list for seamless loop
  const icons = sources.filter((s) => (s.iconUrl ?? "").trim().length > 0);

  if (!icons.length) return null;

  return (
    <Box
      sx={{
        position: "relative",
        width: { xs: "100%", md: 520 },
        maxWidth: "100%",
        height: 40,
        overflow: "hidden",
        borderRadius: 999,
      }}
    >
      {/* Fade masks */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 44,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "linear-gradient(to right, rgba(21,101,192,1), rgba(21,101,192,0))",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 44,
          zIndex: 2,
          pointerEvents: "none",
          background:
            "linear-gradient(to left, rgba(21,101,192,1), rgba(21,101,192,0))",
        }}
      />

      {/* Track */}
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1.2,
            pr: 2,
            animation: "wargalMarquee 22s linear infinite",
            "@keyframes wargalMarquee": {
              "0%": { transform: "translateX(0)" },
              "100%": { transform: "translateX(-50%)" },
            },
            // Two copies to loop seamlessly
            width: "max-content",
          }}
        >
          {[...icons, ...icons].map((s, idx) => (
            <Avatar
              key={`${s.id}-${idx}`}
              src={(s.iconUrl ?? "").trim() || undefined}
              alt={s.name}
              sx={{
                width: 28,
                height: 28,
                bgcolor: "rgba(255,255,255,0.25)",
                border: "1px solid rgba(255,255,255,0.35)",
              }}
              imgProps={{ draggable: false }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}
