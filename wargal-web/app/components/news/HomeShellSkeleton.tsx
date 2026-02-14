"use client";

import { Box, Skeleton } from "@mui/material";

export default function HomeShellSkeleton() {
  return (
    <Box sx={{ px: 2, py: 2 }}>
      <Skeleton variant="rectangular" height={420} sx={{ borderRadius: 3 }} />

      <Box sx={{ mt: 2, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 2 }}>
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} variant="rectangular" height={160} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
    </Box>
  );
}
