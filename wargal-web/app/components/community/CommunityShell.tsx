"use client";

import * as React from "react";
import { Box, Typography } from "@mui/material";
import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/app/providers/AuthProvider";
import { fetchFeedItems, fetchPosts, type PostDto } from "@/app/lib/api";
import type { NewsItem } from "@/app/types/news";

import TopSideBar from "@/app/components/news/TopSidebar";
import PostComposer from "@/app/components/community/PostComposer";
import PostCard from "@/app/components/community/PostCard";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function isEditorOrAdmin(role?: string | null) {
  const r = clean(role).toLowerCase();
  return r === "admin" || r === "editor";
}

export default function CommunityShell() {
  const { isReady, isAuthed, user } = useAuth();

  // Posts polling for "real-time"
  const postsQ = useQuery({
    queryKey: ["posts"],
    queryFn: fetchPosts,
    enabled: isReady && isAuthed,
    refetchInterval: 8_000,
    refetchOnWindowFocus: true,
  });

  // Latest news (left column)
  const latestQ = useQuery({
    queryKey: ["communityLatestNews"],
    queryFn: async () => {
      const items = await fetchFeedItems({ page: 1, pageSize: 40 });
      return (items ?? []).filter(Boolean).slice(0, 10);
    },
    enabled: true,
    refetchInterval: 60_000,
  });

  const onOpenNews = (it: NewsItem) => {
    const url = clean(it?.url);
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (!isReady) return <Box sx={{ p: 2 }} />;

  if (!isAuthed) {
    return (
      <Box sx={{ p: 2 }}>
        <Box
          sx={{
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 2,
            p: 3,
            maxWidth: 720,
            mx: "auto",
          }}
        >
          <Typography fontWeight={950} fontSize={18}>
            Sign in required
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            Community requires login.
          </Typography>
        </Box>
      </Box>
    );
  }

  const canPost = isEditorOrAdmin(user?.role);
  const posts = (postsQ.data ?? []) as PostDto[];
  const latest = (latestQ.data ?? []) as NewsItem[];

  return (
    <Box sx={{ bgcolor: "#f5f7fb", minHeight: "100vh" }}>
      <Box sx={{ px: { xs: 1.5, md: 2 }, py: 2 }}>
        {/* Facebook-like container width */}
        <Box sx={{ maxWidth: 1280, mx: "auto" }}>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              alignItems: "start",
              gridTemplateColumns: {
                xs: "1fr",
                md: "1fr",
                lg: "320px minmax(0,1fr) 320px", // left + center + right spacer
              },
            }}
          >
            {/* LEFT (only large screens): Latest */}
            <Box sx={{ display: { xs: "none", lg: "block" }, position: "sticky", top: 86 }}>
              <TopSideBar title="Latest" items={latest} onOpen={onOpenNews} />
            </Box>

            {/* CENTER: Feed */}
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" fontWeight={900} sx={{ mb: 1 }}>
                Community
              </Typography>

              {/* composer */}
              {canPost && <PostComposer user={user!} />}

              {/* Feed states */}
              {postsQ.isLoading ? (
                <Box
                  sx={{
                    mt: 1.5,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 3,
                  }}
                >
                  <Typography fontWeight={900}>Loading posts…</Typography>
                </Box>
              ) : postsQ.isError ? (
                <Box
                  sx={{
                    mt: 1.5,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 3,
                  }}
                >
                  <Typography fontWeight={900} color="error">
                    Failed to load posts
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {(postsQ.error as any)?.message ?? "Unknown error"}
                  </Typography>
                </Box>
              ) : posts.length === 0 ? (
                <Box
                  sx={{
                    mt: 1.5,
                    bgcolor: "background.paper",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                    p: 3,
                  }}
                >
                  <Typography fontWeight={950}>No posts yet</Typography>
                  <Typography color="text.secondary" sx={{ mt: 0.5 }}>
                    Posts will appear here with comments and reactions.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ mt: 1.5 }}>
                  {posts.map((p) => (
                    <Box key={p.id} sx={{ mb: 1.5 }}>
                      <PostCard post={p} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>

            {/* RIGHT spacer / optional content to center the feed like Facebook */}
            <Box sx={{ display: { xs: "none", lg: "block" } }} />
          </Box>

          {/* Mobile/tablet: Latest below */}
          <Box sx={{ mt: 2, display: { xs: "block", lg: "none" } }}>
            <TopSideBar title="Latest" items={latest} onOpen={onOpenNews} />
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
