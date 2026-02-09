"use client";

import * as React from "react";
import { fetchFeedItems } from "@/app/lib/api";
import { NewsItem } from "@/app/types/news";
import NewsFeedList from "@/app/components/news/NewsFeedList";
import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";

export default function BreakingPage() {
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      const data = await fetchFeedItems({ page: 1, pageSize: 30 });
      setItems(data);
      setLoading(false);
    })();
  }, []);

  const open = (it: NewsItem) => window.open(it.url, "_blank", "noopener,noreferrer");

  if (loading) return <div style={{ padding: 16 }}>Loading…</div>;

  return (
    <>
      <BreakingSlideshow items={items.slice(0, 6)} onOpen={open} />
      <NewsFeedList items={items} onOpen={open} />
    </>
  );
}
