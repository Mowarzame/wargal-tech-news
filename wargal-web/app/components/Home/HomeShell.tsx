"use client";

import { useMemo, useState } from "react";
import {
  Box,
  Divider,
  Typography,
  Drawer,
  IconButton,
  Button,
  useMediaQuery,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import TuneIcon from "@mui/icons-material/Tune";
import { useTheme } from "@mui/material/styles";

import { NewsItem, NewsSource } from "@/app/types/news";

import SourcesSidebar from "@/app/components/Home/SourcesSidebar";
import BreakingSlideshow from "@/app/components/breaking/BreakingSlideshow";
import NewsGridHighlights from "@/app/components/news/NewsGridHighlights";
import FourUpRow from "@/app/components/news/FourUpRow";
import CategoryLanes from "@/app/components/news/CategoryLanes";
import AllNewsSection from "@/app/components/news/AllNewsSection";
import TopSideBar from "@/app/components/news/TopSidebar";

type Props = {
  items: NewsItem[];
  sources: NewsSource[];
  categoryBySourceId: Record<string, string>;
};

export default function HomeShell({ items, sources, categoryBySourceId }: Props) {
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);
  const [sourcesOpen, setSourcesOpen] = useState(false);

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md")); // < md => drawer

  const onOpen = (it: NewsItem) => {
    const url = (it.url ?? "").trim();
    if (!url.startsWith("http")) return;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const filteredItems = useMemo(() => {
    if (!selectedSourceIds.length) return items; // none selected => all
    const set = new Set(selectedSourceIds.map(String));
    return items.filter((it) => it.sourceId && set.has(String(it.sourceId)));
  }, [items, selectedSourceIds]);

  const getCategory = (sourceId?: string) => {
    if (!sourceId) return "General";
    return categoryBySourceId[String(sourceId)] ?? "General";
  };

  // Sections from filteredItems
  const breakingItems = filteredItems.slice(0, 8);
  const highlightsItems = filteredItems.slice(8, 14);
  const moreStoriesItems = filteredItems.slice(14, 18);

  // Latest: avoid duplicates already used above
  const used = new Set<string>();
  for (const it of [...breakingItems, ...highlightsItems, ...moreStoriesItems]) {
    used.add(it.url?.trim() ? `u:${it.url.trim()}` : `id:${it.id}`);
  }

  const latestItems = filteredItems
    .filter((it) => {
      const k = it.url?.trim() ? `u:${it.url.trim()}` : `id:${it.id}`;
      return !used.has(k);
    })
    .slice(0, 7); // ✅ only 7 as requested

  const anySourcesSelected = selectedSourceIds.length > 0;

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", md: "280px 1fr 360px" },
        gap: 2,
        alignItems: "start",
        mt: 1,
      }}
    >
      {/* LEFT: Sources (desktop only) */}
      <Box
        sx={{
          display: { xs: "none", md: "block" },
          position: "sticky",
          top: 12,
          alignSelf: "start",
          maxHeight: "calc(100vh - 24px)",
          overflow: "auto",
          pr: 0.5,
        }}
      >
        <SourcesSidebar
          sources={sources}
          selectedIds={selectedSourceIds}
          onChange={setSelectedSourceIds}
        />
      </Box>

      {/* CENTER: Main */}
      <Box sx={{ minWidth: 0 }}>
        {/* MOBILE: Sources button row */}
        <Box
          sx={{
            display: { xs: "flex", md: "none" },
            alignItems: "center",
            justifyContent: "space-between",
            mb: 1.5,
            gap: 1,
          }}
        >
          <Typography variant="h6" fontWeight={900}>
            Breaking
          </Typography>

          <Button
            variant="outlined"
            startIcon={<TuneIcon />}
            onClick={() => setSourcesOpen(true)}
            sx={{ borderRadius: 2, whiteSpace: "nowrap" }}
          >
            Sources{selectedSourceIds.length ? ` (${selectedSourceIds.length})` : ""}
          </Button>
        </Box>

        {/* DESKTOP: section title (since mobile shows it above) */}
        <Typography
          variant="h6"
          fontWeight={900}
          sx={{ mb: 1.5, display: { xs: "none", md: "block" } }}
        >
          Breaking
        </Typography>

        <BreakingSlideshow items={breakingItems} onOpen={onOpen} />

        <Box sx={{ mt: 2 }}>
          <SectionTitle title="Highlights" />
          <NewsGridHighlights items={highlightsItems} onOpen={onOpen} />
        </Box>

        {/* When sources selected: hide More Stories + Categories (per your rule) */}
        {!anySourcesSelected && (
          <>
            <Divider sx={{ my: 3 }} />
            <SectionTitle title="More Stories" />
            <FourUpRow items={moreStoriesItems} onOpen={onOpen} />

            <Divider sx={{ my: 3 }} />
            {/* Categories placement handled elsewhere in your flow if needed */}
            <SectionTitle title="Categories" />
            <CategoryLanes items={filteredItems} getCategory={getCategory} onOpen={onOpen} />
          </>
        )}

        <Divider sx={{ my: 3 }} />

        <SectionTitle title={anySourcesSelected ? "All news (selected sources)" : "All News"} />
        <AllNewsSection initialItems={filteredItems} pageSize={30} />
      </Box>

      {/* RIGHT: Latest (hide on mobile to reduce clutter) */}
      <Box
        sx={{
          position: "sticky",
          top: 12,
          alignSelf: "start",
          display: { xs: "none", lg: "block" },
        }}
      >
        <TopSideBar title="Latest" items={latestItems} onOpen={onOpen} />
      </Box>

      {/* MOBILE DRAWER */}
      <Drawer
        anchor="left"
        open={sourcesOpen}
        onClose={() => setSourcesOpen(false)}
        ModalProps={{ keepMounted: true }} // better perf on mobile
        PaperProps={{
          sx: { width: "min(86vw, 320px)" },
        }}
      >
        <Box sx={{ p: 2, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography fontWeight={900} sx={{ flex: 1 }}>
            Sources
          </Typography>
          <IconButton onClick={() => setSourcesOpen(false)} aria-label="Close">
            <CloseIcon />
          </IconButton>
        </Box>

        <Box sx={{ px: 2, pb: 2, overflow: "auto" }}>
          <SourcesSidebar
            sources={sources}
            selectedIds={selectedSourceIds}
            onChange={(next) => {
              setSelectedSourceIds(next);
            }}
          />
        </Box>
      </Drawer>
    </Box>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <Typography variant="h6" fontWeight={900} sx={{ mb: 1.5 }}>
      {title}
    </Typography>
  );
}
