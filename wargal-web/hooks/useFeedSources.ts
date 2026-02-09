import { useQuery } from "@tanstack/react-query";
import { fetchFeedSources } from "@/app/lib/api";

export function useFeedSources() {
  return useQuery({
    queryKey: ["feed-sources"],
    queryFn: fetchFeedSources,
    staleTime: 5 * 60 * 1000, // sources change rarely
  });
}
