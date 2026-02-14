// ==============================
// File: wargal-web/app/page.tsx
// ✅ SSR + SEO (Brand-first for "Wargal" / "Wargal News")
// ✅ Performance optimization: stream the UI instantly (no blocking await in Page)
// ✅ Fix: HomeData must be used as async server component inside Suspense
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

// ✅ Strongly prefer cached fetches for this route segment (helps TTFB)
export const fetchCache = "force-cache";

// ==============================
// Page-specific SEO Metadata
// (Layout already has template/base. Page adds richer homepage title/description.)
// ==============================

export const metadata: Metadata = {
  title: "Wargal News – Somali News, Community & Breaking Updates",
  description:
    "Wargal News (Wargal) is a Somali news aggregator and community. Read breaking news, watch videos, and join discussions from trusted sources.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Wargal News – Somali News, Community & Breaking Updates",
    description:
      "Wargal News (Wargal) is a Somali news aggregator and community. Breaking news, videos, and discussions.",
    url: "https://www.wargalnews.com",
  },
};

// ==============================
// Structured Data (Google)
// ==============================

function StructuredData() {
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Wargal News",
    alternateName: ["Wargal", "Wargal News"],
    url: "https://www.wargalnews.com",
    logo: "https://www.wargalnews.com/images/logo/correctLogo.png",
    sameAs: [
      // ✅ Replace with your real links when ready
      // "https://www.facebook.com/yourpage",
      // "https://www.instagram.com/yourpage",
      // "https://www.youtube.com/@yourchannel",
      // "https://x.com/yourhandle",
    ],
  };

  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Wargal News",
    alternateName: "Wargal",
    url: "https://www.wargalnews.com",
    publisher: {
      "@type": "Organization",
      name: "Wargal News",
      logo: {
        "@type": "ImageObject",
        url: "https://www.wargalnews.com/images/logo/correctLogo.png",
      },
    },
  };

  const webpage = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: "Wargal News",
    url: "https://www.wargalnews.com",
    description:
      "Wargal News (Wargal) is a Somali news aggregator and community. Read breaking news, watch videos, and join discussions from trusted sources.",
    isPartOf: {
      "@type": "WebSite",
      name: "Wargal News",
      url: "https://www.wargalnews.com",
    },
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(org) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(website) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(webpage) }} />
    </>
  );
}

// ==============================
// Fast parallel fetch (cached)
// ✅ NOTE: We DO NOT await this in Page anymore (so the shell streams instantly)
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
// ✅ Streamed data boundary
// This async component runs inside <Suspense>, allowing instant first paint.
// ==============================

async function HomeData() {
  const data = await getData();

  return (
    <HomeShell
      items={data.items ?? []}
      sources={data.sources ?? []}
      categoryBySourceId={data.categoryBySourceId}
    />
  );
}

// ==============================
// Page Component
// ✅ Performance: no blocking await here => faster initial render/stream.
// ==============================

export default function Page() {
  return (
    <>
      <StructuredData />

      {/* ✅ SEO H1: Helps Google associate homepage with "Wargal / Wargal News" */}
      <h1 style={{ position: "absolute", left: -10000, top: "auto", width: 1, height: 1, overflow: "hidden" }}>
        Wargal News (Wargal) – Somali News, Videos & Community
      </h1>

      <Suspense fallback={<HomeShellSkeleton />}>
   
        <HomeData />
      </Suspense>
    </>
  );
}
