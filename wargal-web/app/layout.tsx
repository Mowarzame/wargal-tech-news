// ==============================
// File: wargal-web/app/layout.tsx
// ==============================

import type { Metadata } from "next";
import Providers from "./providers";
import Navbar from "@/app/components/layout/Navbar";
import Script from "next/script";
import Footer from "./components/layout/Footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.wargalnews.com"),

  title: {
    default: "Wargal News",
    template: "%s | Wargal News",
  },

  description:
    "Wargal News is a Somali news aggregator and community. Read breaking updates, watch videos, and join discussions.",

  applicationName: "Wargal News",
  generator: "Next.js",
  referrer: "origin-when-cross-origin",

  keywords: [
    "Wargal",
    "Wargal News",
    "Somali news",
    "Somalia news",
    "Hargeisa news",
    "Somali community",
    "breaking news",
    "Somali videos",
    "Somali articles",
  ],

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-snippet": -1,
      "max-image-preview": "large",
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",
    url: "https://www.wargalnews.com",
    siteName: "Wargal News",
    title: "Wargal News",
    description:
      "Somali news aggregator and community. Breaking updates, videos, and discussions from trusted sources.",
    images: [
      {
        url: "/images/logo/correctLogo.png",
        width: 1200,
        height: 630,
        alt: "Wargal News",
      },
    ],
    locale: "en_US",
  },

  twitter: {
    card: "summary_large_image",
    title: "Wargal News",
    description:
      "Somali news aggregator and community. Breaking updates, videos, and discussions.",
    images: ["/images/logo/correctLogo.png"],
  },

  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/images/logo/correctLogo.png" }],
    apple: [{ url: "/images/logo/correctLogo.png" }],
  },

  manifest: "/site.webmanifest",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Google AdSense verification */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-6865951938086772"
          crossOrigin="anonymous"
        ></script>
      </head>

      <body>
        {/* Google Identity Services (GIS) */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />

        <Providers>
          <Navbar />
          {children}
          <Footer />
        </Providers>
      </body>
    </html>
  );
}