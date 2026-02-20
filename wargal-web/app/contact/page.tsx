// wargal-web/app/contact/page.tsx
import type { Metadata } from "next";
import { Box, Card, CardContent, Divider, Link as MuiLink, Stack, Typography } from "@mui/material";

export const metadata: Metadata = {
  title: "Contact | Wargal News",
  description: "Contact information for Wargal News (Wargal Studio).",
};

export default function ContactPage() {
  // ✅ Use a real email you control. This must be valid and monitored.
  const supportEmail = "wargal118@gmail.com";
  const website = "https://wargalnews.com";

  return (
    <Box
      sx={{
        px: { xs: 2, sm: 3 },
        py: { xs: 2.5, sm: 4 },
        maxWidth: 920,
        mx: "auto",
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 950, mb: 1 }}>
        Contact Us
      </Typography>

      <Typography color="text.secondary" sx={{ mb: 2 }}>
        Wargal News is a Somali news aggregation platform. We curate content from original publishers and
        always link back to the original source.
      </Typography>

      <Card sx={{ borderRadius: 3 }}>
        <CardContent>
          <Stack spacing={1.25}>
            <Typography sx={{ fontWeight: 950 }}>Developer</Typography>
            <Typography>Wargal Studio</Typography>

            <Divider sx={{ my: 1 }} />

            <Typography sx={{ fontWeight: 950 }}>Email</Typography>
            <MuiLink href={`mailto:${supportEmail}`} underline="hover" sx={{ fontWeight: 800 }}>
              {supportEmail}
            </MuiLink>

            <Divider sx={{ my: 1 }} />

            <Typography sx={{ fontWeight: 950 }}>Website</Typography>
            <MuiLink href={website} target="_blank" rel="noreferrer" underline="hover" sx={{ fontWeight: 800 }}>
              {website}
            </MuiLink>

            <Divider sx={{ my: 1 }} />

            <Typography sx={{ fontWeight: 950 }}>Content & Sources</Typography>
            <Typography color="text.secondary">
              Wargal News aggregates publicly available news feeds from original publishers. Each article shows the
              publisher/source and links to the original website. If you believe content is incorrect or should be
              removed, contact us using the email above.
            </Typography>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}