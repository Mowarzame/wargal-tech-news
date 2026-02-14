// ==============================
// File: wargal-web/app/page.tsx
// Fully optimized SSR + SEO + instant load
// ==============================

import { Suspense } from "react";
import HomeShell from "@/app/components/Home/HomeShell";
import HomeShellSkeleton from "@/app/components/news/HomeShellSkeleton";
import { getFeedItems, getFeedSources } from "@/app/lib/api";
import type { Metadata } from "next";

// ✅ Edge runtime for fastest response globally
export const runtime = "edge";

// ✅ Cache and revalidate every 60 seconds
export const revalidate = 60;

// ✅ Enable static optimization
export const dynamic = "force-static";

// ==============================
// SEO Metadata
// ==============================

export const metadata: Metadata = {
  title: {
    default: "Wargal News – Somali News, Community & Breaking Updates",
    template: "%s | Wargal News",
  },

  description:
    "Wargal News is the fastest Somali news aggregator and community. Read breaking news, watch videos, and join discussions from trusted Somali and global sources.",

  keywords: [
    "Somali news",
    "Somalia news",
    "Wargal News",
    "Somali tech news",
    "Somali community",
    "breaking news Somalia",
    "Somali videos",
    "Somali articles",
  ],

  metadataBase: new URL("https://www.wargalnews.com"),

  alternates: {
    canonical: "/",
  },

  openGraph: {
    title: "Wargal News – Somali News, Community & Breaking Updates",
    description:
      "The fastest Somali news platform. Breaking news, videos, and community discussions.",
    url: "https://www.wargalnews.com",
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
    description:
      "Breaking Somali news, videos, and community discussions.",
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

// ==============================
// Structured Data for Google SEO
// ==============================

function StructuredData() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wargal News",
    url: "https://www.wargalnews.com",
    description:
      "Fast Somali news aggregator and community platform.",
    publisher: {
      "@type": "Organization",
      name: "Wargal News",
      logo: {
        "@type": "ImageObject",
        url: "https://www.wargalnews.com/images/logo/correctLogo.png",
      },
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

// ==============================
// Fast parallel fetch (cached)
// ==============================

async function getData() {
  const [items, sources] = await Promise.all([
    getFeedItems(),
    getFeedSources(),
  ]);

  const categoryBySourceId: Record<string, string> = {};

  for (const s of sources ?? []) {
    if (!s?.id) continue;
    categoryBySourceId[String(s.id)] =
      (s.category ?? "General").trim() || "General";
  }

  return {
    items,
    sources,
    categoryBySourceId,
  };
}

// ==============================
// Page Component
// ==============================

export default async function Page() {
  const data = await getData();

  return (
    <>
      <StructuredData />

      <Suspense fallback={<HomeShellSkeleton />}>
        <HomeShell
          items={data.items ?? []}
          sources={data.sources ?? []}
          categoryBySourceId={data.categoryBySourceId}
        />
      </Suspense>
    </>
  );
}
