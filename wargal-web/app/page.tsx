import { Container } from "@mui/material";
import HomeShell from "@/app/components/Home/HomeShell";
import { getFeedItems, getFeedSources } from "@/app/lib/api";

export default async function Page() {
  const [items, sources] = await Promise.all([getFeedItems(), getFeedSources()]);

  const categoryBySourceId: Record<string, string> = {};
  for (const s of sources ?? []) {
    const cat =
      s.category && String(s.category).trim()
        ? String(s.category).trim()
        : "General";
    categoryBySourceId[String(s.id)] = cat;
  }

  return (
    <Container maxWidth="xl" sx={{ py: 2, px: { xs: 1.5, sm: 2, md: 3 } }}>
      <HomeShell
        items={items}
        sources={sources}
        categoryBySourceId={categoryBySourceId}
      />
    </Container>
  );
}
