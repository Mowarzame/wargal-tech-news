import { Box, Card, CardContent, Divider, Skeleton, Stack } from "@mui/material";

export default function Loading() {
  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 2.5, sm: 4 },
        maxWidth: 920,
        mx: "auto",
        minHeight: "60vh",
      }}
    >
      {/* Title */}
      <Skeleton variant="text" width={240} height={42} sx={{ mb: 1 }} />

      {/* Subtitle */}
      <Skeleton variant="text" width="100%" height={24} />
      <Skeleton variant="text" width="80%" height={24} sx={{ mb: 2 }} />

      {/* Contact card */}
      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={1.5}>
            {/* Developer */}
            <Skeleton variant="text" width={140} height={26} />
            <Skeleton variant="text" width={180} height={22} />

            <Divider sx={{ my: 1 }} />

            {/* Email */}
            <Skeleton variant="text" width={100} height={26} />
            <Skeleton variant="text" width={260} height={22} />

            <Divider sx={{ my: 1 }} />

            {/* Website */}
            <Skeleton variant="text" width={120} height={26} />
            <Skeleton variant="text" width={300} height={22} />

            <Divider sx={{ my: 1 }} />

            {/* Description */}
            <Skeleton variant="text" width="100%" height={22} />
            <Skeleton variant="text" width="95%" height={22} />
            <Skeleton variant="text" width="85%" height={22} />
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}