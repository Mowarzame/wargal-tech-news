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
// SEO Metadata (Homepage-specific)
// ==============================

export const metadata: Metadata = {
  title: "Wargal News – Somali News, Community & Breaking Updates",
  description:
    "Wargal News is the fastest Somali news aggregator and community. Read breaking news, watch videos, and join discussions from trusted Somali and global sources.",
  keywords: [
    "Wargal",
    "Wargal News",
    "Somali news",
    "Somalia news",
    "Somali tech news",
    "Somali community",
    "breaking news Somalia",
    "Somali videos",
    "Somali articles",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Wargal News – Somali News, Community & Breaking Updates",
    description: "The fastest Somali news platform. Breaking news, videos, and community discussions.",
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
    googleBot: { index: true, follow: true },
  },
};

// ==============================
// Structured Data for Google SEO
// ==============================

function StructuredData() {
  const orgLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Wargal News",
    url: "https://wargalnews.com",
    logo: "https://wargalnews.com/images/logo/correctLogo.png",
  };

  const siteLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wargal News",
    url: "https://wargalnews.com",
    description: "Fast Somali news aggregator and community platform.",
    publisher: {
      "@type": "Organization",
      name: "Wargal News",
      logo: {
        "@type": "ImageObject",
        url: "https://wargalnews.com/images/logo/correctLogo.png",
      },
    },
    potentialAction: {
      "@type": "SearchAction",
      target: "https://wargalnews.com/?q={search_term_string}",
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(siteLd) }}
      />
    </>
  );
}

// ==============================
// Fast parallel fetch (cached)
// ==============================

async function getData() {
  const [items, sources] = await Promise.all([getFeedItems(), getFeedSources()]);

  const categoryBySourceId: Record<string, string> = {};

  for (const s of sources ?? []) {
    if (!s?.id) continue;
    categoryBySourceId[String(s.id)] = (s.category ?? "General").trim() || "General";
  }

  return { items, sources, categoryBySourceId };
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
