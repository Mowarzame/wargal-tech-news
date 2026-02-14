// ==============================
// File: wargal-web/app/components/news/HomeShellSkeleton.tsx
// ✅ Skeleton that closely matches HomeShell.tsx structure
// - Left: Sources panel (desktop)
// - Center: Breaking slideshow + Highlights + More Stories blocks
// - Right: Latest sidebar (desktop)
// - Mobile: top summary row + Breaking + Highlights + Latest + More Stories
// ==============================

"use client";

import React from "react";
import { Box, Skeleton, Typography, Divider } from "@mui/material";

function SourceRow() {
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1, py: 1 }}>
      <Skeleton variant="circular" width={26} height={26} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Skeleton variant="text" height={16} width="70%" />
        <Skeleton variant="text" height={14} width="45%" />
      </Box>
      <Skeleton variant="rounded" width={18} height={18} />
    </Box>
  );
}

function LatestRow() {
  return (
    <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", p: 1.25 }}>
      <Skeleton variant="rounded" width={54} height={54} sx={{ borderRadius: 2 }} />
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Skeleton variant="text" height={16} width="95%" />
        <Skeleton variant="text" height={16} width="82%" />
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 0.25 }}>
          <Skeleton variant="text" height={14} width={90} />
          <Skeleton variant="rounded" width={48} height={18} sx={{ borderRadius: 999 }} />
        </Box>
      </Box>
    </Box>
  );
}

function HighlightsGrid() {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
        gap: 2,
      }}
    >
      <Skeleton variant="rounded" height={190} sx={{ borderRadius: 2 }} />
      <Skeleton variant="rounded" height={190} sx={{ borderRadius: 2, display: { xs: "none", sm: "block" } }} />
      <Skeleton variant="rounded" height={190} sx={{ borderRadius: 2, display: { xs: "none", sm: "block" } }} />
    </Box>
  );
}

function BreakingBlock() {
  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        border: "1px solid",
        borderColor: "divider",
        bgcolor: "common.white",
      }}
    >
      {/* Big slideshow area */}
      <Skeleton
        variant="rectangular"
        height={420}
        sx={{
          width: "100%",
          display: "block",
        }}
      />
    </Box>
  );
}

export default function HomeShellSkeleton() {
  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
        {/* Mobile top row (like HomeShell: selection summary + Sources button) */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            alignItems: "center",
            gap: 1,
            mb: 1.5,
          }}
        >
          <Skeleton variant="text" height={18} width={220} />
          <Box sx={{ flex: 1 }} />
          <Skeleton variant="rounded" width={110} height={36} sx={{ borderRadius: 999 }} />
        </Box>

        {/* Layout: Left / Center / Right */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", lg: "260px minmax(0,1fr) 360px" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {/* LEFT: Sources (desktop) */}
          <Box
            sx={{
              display: { xs: "none", lg: "block" },
              position: "sticky",
              top: 86,
              alignSelf: "start",
              height: "calc(100vh - 110px)",
              minHeight: 420,
            }}
          >
            <Box
              sx={{
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
                height: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <Typography fontWeight={900} mb={1}>
                  Sources
                </Typography>

                <Skeleton variant="rounded" height={38} sx={{ borderRadius: 2 }} />

                <Box sx={{ mt: 1, display: "flex", alignItems: "center", gap: 1 }}>
                  <Skeleton variant="rounded" width={84} height={24} sx={{ borderRadius: 999 }} />
                  <Box sx={{ flex: 1 }} />
                  <Skeleton variant="rounded" width={34} height={34} sx={{ borderRadius: 2 }} />
                </Box>

                <Box sx={{ display: "flex", alignItems: "center", mt: 1 }}>
                  <Skeleton variant="text" height={16} width={46} />
                  <Box sx={{ flex: 1 }} />
                  <Skeleton variant="text" height={16} width={22} />
                </Box>
              </Box>

              <Divider />

              <Box sx={{ flex: 1, overflow: "hidden" }}>
                {Array.from({ length: 11 }).map((_, i) => (
                  <SourceRow key={i} />
                ))}
              </Box>
            </Box>
          </Box>

          {/* CENTER */}
          <Box sx={{ minWidth: 0 }}>
            {/* Breaking header row */}
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Skeleton variant="text" height={32} width={120} />
              <Skeleton variant="rounded" width={44} height={24} sx={{ borderRadius: 999 }} />
              <Box sx={{ flex: 1 }} />
              <Skeleton variant="rounded" width={34} height={34} sx={{ borderRadius: 2 }} />
            </Box>

            {/* Breaking slideshow */}
            <BreakingBlock />

            {/* Highlights */}
            <Box sx={{ mt: 2, mb: 1 }}>
              <Skeleton variant="text" height={32} width={140} />
            </Box>
            <HighlightsGrid />

            {/* Mobile Latest block (HomeShell shows Latest on mobile under highlights) */}
            <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
              <Box
                sx={{
                  bgcolor: "common.white",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: 2,
                  overflow: "hidden",
                }}
              >
                <Box sx={{ p: 1.5 }}>
                  <Skeleton variant="text" height={28} width={110} />
                </Box>
                <Divider />
                {Array.from({ length: 5 }).map((_, i) => (
                  <React.Fragment key={i}>
                    <LatestRow />
                    {i !== 4 && <Divider />}
                  </React.Fragment>
                ))}
              </Box>
            </Box>

            {/* More Stories (desktop in center; mobile appears at bottom) */}
            <Box sx={{ mt: 2, display: { xs: "none", lg: "block" } }}>
              <Skeleton variant="text" height={32} width={170} sx={{ mb: 1 }} />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 2,
                }}
              >
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: 2 }} />
                ))}
              </Box>
            </Box>

            {/* Categories section placeholder */}
            <Box sx={{ mt: 2 }}>
              <Skeleton variant="text" height={32} width={170} sx={{ mb: 1 }} />
              <Skeleton variant="rounded" height={160} sx={{ borderRadius: 2 }} />
            </Box>

            {/* All News grid placeholder */}
            <Box sx={{ mt: 2 }}>
              <Skeleton variant="text" height={32} width={150} sx={{ mb: 1 }} />
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, minmax(0, 1fr))" },
                  gap: 2,
                }}
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={170} sx={{ borderRadius: 2 }} />
                ))}
              </Box>
            </Box>
          </Box>

          {/* RIGHT: Latest (desktop sticky) */}
          <Box
            sx={{
              position: "sticky",
              top: 86,
              alignSelf: "start",
              display: { xs: "none", lg: "block" },
            }}
          >
            <Box
              sx={{
                bgcolor: "common.white",
                border: "1px solid",
                borderColor: "divider",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <Skeleton variant="text" height={28} width={110} />
              </Box>
              <Divider />
              {Array.from({ length: 5 }).map((_, i) => (
                <React.Fragment key={i}>
                  <LatestRow />
                  {i !== 4 && <Divider />}
                </React.Fragment>
              ))}
            </Box>
          </Box>
        </Box>

        {/* Small screen: More Stories at bottom (matches HomeShell placement) */}
        <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
          <Skeleton variant="text" height={32} width={170} sx={{ mb: 1 }} />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "repeat(2, minmax(0, 1fr))" },
              gap: 2,
            }}
          >
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 2 }} />
            ))}
          </Box>
        </Box>

        <Box sx={{ mt: 2 }}>
          <Skeleton variant="text" height={16} width={220} />
        </Box>
      </Box>
    </Box>
  );
}
