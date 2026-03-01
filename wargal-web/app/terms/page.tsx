import { Box, Container, Divider, Link, Typography } from "@mui/material";

export const metadata = {
  title: "Terms of Service | Wargal",
  description: "Wargal Terms of Service",
};

export default function TermsPage() {
  const lastUpdated = "2026-03-01"; // ✅ set a fixed date (recommended for policy pages)

  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Terms of Service
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.75, mb: 3 }}>
          Last updated: {lastUpdated}
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.8 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              1. Acceptance of Terms
            </Typography>
            <Typography variant="body1">
              By accessing or using Wargal (the “Service”), you agree to be bound by these
              Terms. If you do not agree, do not use the Service.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              2. What Wargal Does
            </Typography>
            <Typography variant="body1">
              Wargal aggregates and displays content from public sources (for example RSS feeds
              and publicly accessible webpages). Wargal does not claim ownership of third-party
              content.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              3. Third-Party Content & Links
            </Typography>
            <Typography variant="body1">
              The Service may include links to third-party sites and content. Wargal is not
              responsible for third-party websites, availability, accuracy, or content. Any
              interaction with third-party sites is at your own risk.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              4. Acceptable Use
            </Typography>
            <Typography variant="body1">
              You agree not to misuse the Service, including attempting to disrupt the Service,
              access systems without authorization, or scrape beyond normal browsing.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              5. Intellectual Property
            </Typography>
            <Typography variant="body1">
              Wargal branding, logos, and original UI elements are owned by Wargal or its
              licensors. Third-party trademarks and content belong to their respective owners.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              6. Disclaimer
            </Typography>
            <Typography variant="body1">
              The Service is provided “as is” and “as available.” Wargal does not guarantee
              uninterrupted access, completeness, or accuracy of content.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              7. Limitation of Liability
            </Typography>
            <Typography variant="body1">
              To the maximum extent permitted by law, Wargal will not be liable for any indirect,
              incidental, special, consequential, or punitive damages arising from your use of the
              Service.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              8. Changes to the Service or Terms
            </Typography>
            <Typography variant="body1">
              We may update the Service or these Terms at any time. Continued use of the Service
              after changes means you accept the updated Terms.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              9. Contact
            </Typography>
            <Typography variant="body1">
              For questions about these Terms, contact{" "}
              <Link href="mailto:support@wargalnews.com">support@wargalnews.com</Link>.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mt: 4, mb: 2 }} />

        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Related: <Link href="/privacy">Privacy Policy</Link>
        </Typography>
      </Box>
    </Container>
  );
}