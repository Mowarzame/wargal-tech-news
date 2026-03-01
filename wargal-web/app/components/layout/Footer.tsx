"use client";

import NextLink from "next/link";
import { Box, Container, Divider, Link, Typography } from "@mui/material";

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <Box
      component="footer"
      sx={{
        mt: 6,
        pt: 4,
        pb: 3,
        bgcolor: "background.paper",
        borderTop: "1px solid",
        borderColor: "divider",
      }}
    >
      <Container maxWidth="lg">
        {/* Top Section */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 3,
          }}
        >
          {/* Brand */}
{/* Brand */}
<Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
  <Box
    component="img"
    src="/images/logo/correctLogo.png"
    alt="Wargal"
    sx={{
      width: 48,
      height: 48,
      borderRadius: 1,
    }}
    draggable={false}
  />

  <Box>
    <Typography variant="h6" sx={{ fontWeight: 900, lineHeight: 1.1 }}>
      Wargal News
    </Typography>
    <Typography variant="body2" color="text.secondary">
      Somali tech & news aggregator + community platform.
    </Typography>
  </Box>
</Box>

          {/* Links */}
          <Box
            sx={{
              display: "flex",
              gap: 3,
              flexWrap: "wrap",
            }}
          >
            <Link component={NextLink} href="/about" underline="hover">
              About
            </Link>

            <Link component={NextLink} href="/contact" underline="hover">
              Contact
            </Link>

            <Link component={NextLink} href="/terms" underline="hover">
              Terms
            </Link>

            <Link component={NextLink} href="/privacy" underline="hover">
              Privacy
            </Link>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        {/* Bottom Section */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            justifyContent: "space-between",
            alignItems: { xs: "flex-start", md: "center" },
            gap: 1,
          }}
        >
          <Typography variant="caption" color="text.secondary">
            © {year} Wargal. All rights reserved.
          </Typography>

          <Typography variant="caption" color="text.secondary">
            Aggregating publicly available Somali news sources.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}