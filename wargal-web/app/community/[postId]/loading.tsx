import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh", px: { xs: 1.5, md: 2 }, py: 2 }}>
      <Box sx={{ maxWidth: 1280, mx: "auto" }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            alignItems: "start",
            gridTemplateColumns: {
              xs: "1fr",
              md: "1fr",
              lg: "320px minmax(0,1fr) 320px",
            },
          }}
        >
          {/* LEFT Latest (desktop) */}
          <Box sx={{ display: { xs: "none", lg: "block" }, position: "sticky", top: 86 }}>
            <Skeleton variant="rounded" height={560} />
          </Box>

          {/* CENTER Post */}
          <Box sx={{ minWidth: 0 }}>
            <Skeleton variant="rounded" height={72} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={620} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={420} />
          </Box>

          {/* RIGHT spacer */}
          <Box sx={{ display: { xs: "none", lg: "block" } }} />
        </Box>

        {/* Mobile/tablet Latest below */}
        <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
          <Skeleton variant="rounded" height={420} />
        </Box>
      </Box>
    </Box>
  );
}