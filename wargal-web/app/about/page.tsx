import { Box, Container, Divider, Link, Typography } from "@mui/material";

export const metadata = {
  title: "About Wargal | Somali News & Tech Aggregator",
  description:
    "Learn about Wargal — a Somali tech and news aggregation platform bringing trusted public sources together in one place.",
};

export default function AboutPage() {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: { xs: 4, md: 6 } }}>
        <Typography variant="h4" sx={{ fontWeight: 900, mb: 2 }}>
          About Wargal
        </Typography>

        <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.8 }}>
          Wargal is a Somali news and technology aggregation platform designed
          to bring trusted public news sources together in one simple, fast,
          and accessible experience. Our goal is to make it easier for Somali
          readers to discover updates from multiple outlets in one place.
        </Typography>

        <Divider sx={{ my: 3 }} />

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3, lineHeight: 1.8 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Our Mission
            </Typography>
            <Typography variant="body1">
              We aim to support the Somali digital ecosystem by improving
              access to public information, highlighting trusted news sources,
              and building a modern platform for discussion and community
              engagement.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              How Wargal Works
            </Typography>
            <Typography variant="body1">
              Wargal aggregates publicly available content using RSS feeds and
              external links from established Somali news websites and
              channels. We do not claim ownership of third-party content.
              Clicking on articles may redirect users to the original publisher
              for full details.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Community
            </Typography>
            <Typography variant="body1">
              In addition to news aggregation, Wargal includes a community
              space where registered users can engage in discussions. Our goal
              is to encourage respectful dialogue and knowledge sharing within
              the Somali tech and news community.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Transparency
            </Typography>
            <Typography variant="body1">
              Wargal may display advertising to support operational costs and
              continued development. We do not sell user data. Basic account
              information is used only for authentication and platform
              functionality.
            </Typography>
          </Box>

          <Box>
            <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
              Contact Us
            </Typography>
            <Typography variant="body1">
              If you are a publisher and would like your content included or
              removed, or if you have general questions, please contact us at{" "}
              <Link href="mailto:support@wargalnews.com">
                support@wargalnews.com
              </Link>.
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 4 }} />

        <Typography variant="body2" color="text.secondary">
          Wargal — Building the future of Somali digital media.
        </Typography>
      </Box>
    </Container>
  );
}