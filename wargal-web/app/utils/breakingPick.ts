import { NewsItem } from "@/app/types/news";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

export function uniqueByUrlLatest(items: NewsItem[]) {
  const sorted = [...items].sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  const seen = new Set<string>();
  const out: NewsItem[] = [];
  for (const it of sorted) {
    const u = clean(it.url);
    if (!u) continue;
    if (seen.has(u)) continue;
    seen.add(u);
    out.push(it);
  }
  return out;
}

/**
 * Slideshow: latest + no duplicates + prefer different sources + must have image
 */
export function pickBreakingSlides(items: NewsItem[], max = 8) {
  const latest = uniqueByUrlLatest(items);

  const usedSources = new Set<string>();
  const slides: NewsItem[] = [];

  // Pass 1: unique sources with images
  for (const it of latest) {
    const img = clean(it.imageUrl);
    const src = clean(it.sourceName) || "Unknown";
    if (!img) continue;
    if (usedSources.has(src)) continue;

    slides.push(it);
    usedSources.add(src);
    if (slides.length === max) return slides;
  }

  // Pass 2: fill remaining with any image items (still unique by URL already)
  for (const it of latest) {
    if (slides.length === max) break;
    const img = clean(it.imageUrl);
    if (!img) continue;
    if (slides.some((s) => clean(s.url) === clean(it.url))) continue;
    slides.push(it);
  }

  return slides;
}

/**
 * Highlights grid: 3×2 (6 items), prefer images.
 */
export function pickHighlights(items: NewsItem[], max = 6) {
  const latest = uniqueByUrlLatest(items);

  const out: NewsItem[] = [];
  for (const it of latest) {
    if (out.length === max) break;
    if (!clean(it.imageUrl)) continue;
    out.push(it);
  }
  return out;
}
