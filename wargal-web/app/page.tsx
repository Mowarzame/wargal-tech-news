import HomeShell from "@/app/components/Home/HomeShell";
import { getFeedItems, getFeedSources } from "@/app/lib/api";

export default async function Page() {
  const [items, sources] = await Promise.all([getFeedItems(), getFeedSources()]);

  // Build categoryBySourceId map
  const categoryBySourceId: Record<string, string> = {};
  for (const s of sources ?? []) {
    if (!s?.id) continue;
    categoryBySourceId[String(s.id)] = (s.category ?? "General").trim() || "General";
  }

  return (
    <HomeShell
      items={items ?? []}
      sources={sources ?? []}
      categoryBySourceId={categoryBySourceId}
    />
  );
}
