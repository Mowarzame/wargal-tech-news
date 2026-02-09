import { useQuery } from "@tanstack/react-query";
import { fetchFeedItems } from "@/app/lib/api";

export function useFeedItems(params: {
  page?: number;
  pageSize?: number;
  sourceId?: string;
}) {
  return useQuery({
    queryKey: ["feed-items", params],
    queryFn: () => fetchFeedItems(params),
    refetchInterval: 60_000, // 🔥 auto refresh every 60s
  });
}
