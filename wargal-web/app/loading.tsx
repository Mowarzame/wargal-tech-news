// ==============================
// File: wargal-web/app/loading.tsx
// ✅ Route-level loading UI (MUST match the real homepage layout)
// ✅ Uses the exact same skeleton as app/page.tsx fallback
// ==============================

import HomeShellSkeleton from "@/app/components/news/HomeShellSkeleton";

export default function Loading() {
  return <HomeShellSkeleton />;
}
