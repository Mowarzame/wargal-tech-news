import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import { Box, Typography } from "@mui/material";

export default function AiBadge() {
  return (
    <Box
      sx={{
        position: "absolute",
        top: 10,
        right: 10,
        zIndex: 2,
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        px: 1,
        py: 0.35,
        borderRadius: 999,
        bgcolor: "rgba(255,255,255,0.95)",
        border: "1px solid",
        borderColor: "divider",
        boxShadow: 1,
      }}
    >
      <AutoAwesomeIcon sx={{ fontSize: 16 }} />
      <Typography sx={{ fontSize: 12, fontWeight: 950, lineHeight: 1 }}>
        AI
      </Typography>
    </Box>
  );
}