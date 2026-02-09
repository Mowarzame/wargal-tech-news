"use client";

import TopSideBar from "@/app/components/news/TopSidebar";
import { NewsItem } from "@/app/types/news";

type Props = {
  items: NewsItem[];
};

export default function LatestSidebarClient({ items }: Props) {
  const onOpen = (it: NewsItem) => {
    const url = (it.url ?? "").trim();
    if (!url.startsWith("http")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return <TopSideBar title="Latest" items={items} onOpen={onOpen} />;
}
