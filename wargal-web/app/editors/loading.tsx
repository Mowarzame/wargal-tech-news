import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh", px: { xs: 1.5, md: 2 }, py: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "320px minmax(0,1fr)" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Left Latest (only on large) */}
        <Box sx={{ display: { xs: "none", lg: "block" }, position: "sticky", top: 86, alignSelf: "start" }}>
          <Skeleton variant="rounded" height={560} />
        </Box>

        {/* Center community feed */}
        <Box sx={{ minWidth: 0 }}>
          {/* Create post box */}
          <Skeleton variant="rounded" height={130} sx={{ mb: 2 }} />

          {/* Posts */}
          <Skeleton variant="rounded" height={520} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={520} sx={{ mb: 2 }} />
        </Box>
      </Box>
    </Box>
  );
}
