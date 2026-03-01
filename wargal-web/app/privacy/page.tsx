import { Box, Container, Divider, Link, Typography } from "@mui/material";

export const metadata = {
  title: "Privacy Policy | Wargal",
  description: "Wargal Privacy Policy",
};

export default function PrivacyPage() {
  const lastUpdated = "2026-03-01"; // ✅ fixed date

  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="h4" sx={{ fontWeight: 800, mb: 1 }}>
          Privacy Policy
        </Typography>

        <Typography variant="body2" sx={{ opacity: 0.75, mb: 3 }}>
          Last updated: {lastUpdated}
        </Typography>

        <Divider sx={{ mb: 3 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.8 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              1. Overview
            </Typography>
            <Typography variant="body1">
              This Privacy Policy explains how Wargal collects, uses, and protects information
              when you use our website and services.
            </Typography>
          </Box>
<Box>
  <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
    2. Information We Collect
  </Typography>
  <Typography variant="body1">
    We collect only the information necessary to provide account functionality.
    If you sign in, we store your username and basic account identifiers
    required for authentication. We do not collect device fingerprints,
    precise location data, or behavioral tracking information.
  </Typography>
</Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              3. Cookies & Advertising
            </Typography>
            <Typography variant="body1">
              We may use cookies or similar technologies for functionality, analytics, and
              advertising. If we display ads (e.g., via Google AdSense), Google and its partners
              may use cookies to serve personalized or non-personalized ads depending on your
              settings and region.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              4. How We Use Information
            </Typography>
            <Typography variant="body1">
              We use information to operate the Service, improve performance and user experience,
              detect abuse, and show content and ads.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              5. Sharing of Information
            </Typography>
            <Typography variant="body1">
              We do not sell personal information. We may share limited data with service
              providers that help us run the Service (hosting, analytics, ads), and when required
              by law.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              6. Data Retention
            </Typography>
            <Typography variant="body1">
              We retain information only as long as necessary for the purposes described in this
              policy, unless a longer retention period is required by law.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              7. Security
            </Typography>
            <Typography variant="body1">
              We use reasonable safeguards to protect information, but no method of transmission
              or storage is 100% secure.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              8. Your Choices
            </Typography>
            <Typography variant="body1">
              You can control cookies in your browser settings. Where applicable, you may have
              rights to access, correct, or delete your data depending on your region.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              9. Contact
            </Typography>
            <Typography variant="body1">
              If you have questions about this Privacy Policy, contact{" "}
              <Link href="mailto:support@wargalnews.com">support@wargalnews.com</Link>.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ mt: 4, mb: 2 }} />

        <Typography variant="body2" sx={{ opacity: 0.75 }}>
          Related: <Link href="/terms">Terms of Service</Link>
        </Typography>
      </Box>
    </Container>
  );
}