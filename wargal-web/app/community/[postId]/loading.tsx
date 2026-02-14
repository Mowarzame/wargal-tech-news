// ==============================
// File: wargal-web/app/community/[postId]/loading.tsx
// ==============================
import { Box, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", lg: "minmax(0, 720px) 360px" },
          gap: 2,
        }}
      >
        <Box>
          <Skeleton variant="rectangular" height={220} sx={{ borderRadius: 2 }} />
          <Skeleton variant="text" height={44} sx={{ mt: 1 }} />
          <Skeleton variant="text" height={22} width="70%" />
          <Skeleton variant="rectangular" height={380} sx={{ mt: 2, borderRadius: 2 }} />
        </Box>

        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <Skeleton variant="rectangular" height={520} sx={{ borderRadius: 2 }} />
        </Box>
      </Box>
    </Box>
  );
}
