import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh", px: { xs: 1.5, md: 2 }, py: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "260px minmax(0,1fr) 360px" },
          gap: 2,
          alignItems: "start",
        }}
      >
        {/* Left (sources / latest placeholder depending on page) */}
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <Skeleton variant="rounded" height={520} />
        </Box>

        {/* Center feed */}
        <Box sx={{ minWidth: 0 }}>
          <Skeleton variant="text" height={38} width={180} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" height={220} sx={{ mb: 2 }} />

          <Skeleton variant="text" height={32} width={160} sx={{ mb: 1 }} />
          <Skeleton variant="rounded" height={280} sx={{ mb: 2 }} />

          <Skeleton variant="rounded" height={420} />
        </Box>

        {/* Right Latest */}
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <Skeleton variant="rounded" height={520} />
        </Box>
      </Box>

      {/* Mobile extra blocks */}
      <Box sx={{ display: { xs: "block", lg: "none" }, mt: 2 }}>
        <Skeleton variant="rounded" height={220} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={220} />
      </Box>
    </Box>
  );
}
