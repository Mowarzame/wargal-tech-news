import type { Metadata } from "next";
import Providers from "./providers";
import Navbar from "@/app/components/layout/Navbar";
import Script from "next/script";

export const metadata: Metadata = {
  metadataBase: new URL("https://wargalnews.com"),
  title: {
    default: "Wargal News — Somali News, Community & Breaking Updates",
    template: "%s | Wargal News",
  },
  description: "Somali tech/news aggregator + community",
  applicationName: "Wargal News",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Wargal News — Somali News, Community & Breaking Updates",
    description: "Breaking Somali news, videos, and community discussions.",
    url: "https://wargalnews.com",
    siteName: "Wargal News",
    images: [
      {
        url: "/images/logo/correctLogo.png",
        width: 1200,
        height: 630,
        alt: "Wargal News",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Wargal News",
    description: "Breaking Somali news, videos, and community discussions.",
    images: ["/images/logo/correctLogo.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Google Identity Services (GIS) */}
        <Script
          src="https://accounts.google.com/gsi/client"
          strategy="afterInteractive"
        />

        <Providers>
          <Navbar />
          {children}
        </Providers>
      </body>
    </html>
  );
}
