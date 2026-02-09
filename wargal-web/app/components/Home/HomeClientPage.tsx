"use client";

import { Box, Divider, Typography } from "@mui/material";
import { NewsItem } from "@/app/types/news";

import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import FourUpRow from "@/app/components/news/FourUpRow";
import CategoryLanes from "@/app/components/news/CategoryLanes";
import AllNewsSection from "@/app/components/news/AllNewsSection";

type Props = {
  items: NewsItem[];

  highlightsItems: NewsItem[];
  fourUpItems: NewsItem[];
  restForCategories: NewsItem[];

  categoryBySourceId: Record<string, string>;
};

export default function HomeClientPage({
  items,
  highlightsItems,
  fourUpItems,
  restForCategories,
  categoryBySourceId,
}: Props) {
  const onOpen = (it: NewsItem) => {
    const url = (it.url ?? "").trim();
    if (!url.startsWith("http")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const getCategory = (sourceId?: string) => {
    if (!sourceId) return "General";
    return categoryBySourceId[String(sourceId)] ?? "General";
  };

  return (
    <>
      {/* Highlights */}
      <Box sx={{ mt: 2 }}>
        <SectionTitle title="Top Highlights" />
        <NewsGridHighlights items={highlightsItems} onOpen={onOpen} />
      </Box>

      <Divider sx={{ my: 3 }} />

      {/* More Stories */}
      <SectionTitle title="More Stories" />
      <FourUpRow items={fourUpItems} onOpen={onOpen} />

      <Divider sx={{ my: 3 }} />

      {/* Categories */}
      <SectionTitle title="Categories" />
      <CategoryLanes
        items={restForCategories}
        getCategory={getCategory}
        onOpen={onOpen}
      />

      <Divider sx={{ my: 3 }} />

      {/* ✅ All News moved to bottom + Load More */}
      <SectionTitle title="All News" />
      <AllNewsSection initialItems={items} pageSize={30} />
    </>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography
      variant="h6"
      fontWeight={900}
      sx={{ mb: 1.5, letterSpacing: 0.2 }}
    >
      {title}
    </Typography>
  );
}
