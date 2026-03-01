import { Box, Container, Skeleton } from "@mui/material";

export default function Loading() {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        {/* Title */}
        <Skeleton variant="text" width="60%" height={48} sx={{ mb: 2 }} />

        {/* Last updated */}
        <Skeleton variant="text" width="30%" height={24} sx={{ mb: 3 }} />

        {/* Sections */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Box key={i}>
              <Skeleton variant="text" width="40%" height={32} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="100%" />
              <Skeleton variant="text" width="95%" />
              <Skeleton variant="text" width="90%" />
            </Box>
          ))}
        </Box>
      </Box>
    </Container>
  );
}