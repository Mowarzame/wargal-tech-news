// ==============================
// File: wargal-web/app/sitemap.ts
// ✅ Minimal sitemap (expand later with dynamic routes)
// ==============================

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.wargalnews.com";

  return [
    {
      url: `${base}/`,
      lastModified: new Date(),
      changeFrequency: "hourly",
      priority: 1,
    },
    {
      url: `${base}/community`,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 0.7,
    },
  ];
}
