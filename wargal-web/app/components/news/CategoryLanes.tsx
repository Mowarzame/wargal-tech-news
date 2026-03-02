// ==============================
// File: wargal-web/app/components/news/CategoryLanes.tsx
// ✅ 4 columns
// ✅ 3 rows per page (12 items)
// ✅ Pagination enabled
// ✅ AI badge for ForeignNews
// ==============================
"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Stack,
  Avatar,
  Chip,
  Tabs,
  Tab,
  FormControl,
  Select,
  MenuItem,
  InputLabel,
  Pagination,
  SelectChangeEvent,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import CloseIcon from "@mui/icons-material/Close";
import { NewsItem } from "@/app/types/news";
import TimeAgo from "../common/TimeAgo";
import AiSomaliSummary from "@/app/components/ai/AiSomaliSummary";

type Props = {
  items: NewsItem[];
  getCategory: (sourceId?: string) => string;
  onOpen: (item: NewsItem) => void;
};

const PAGE_SIZE = 12; // ✅ 4 columns x 3 rows

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function isForeignCategory(cat?: string | null) {
  return clean(cat).toLowerCase() === "foreignnews";
}

export default function CategoryLanes({ items, getCategory, onOpen }: Props) {
  if (!items?.length) return null;

  const groups = useMemo(() => {
    const map = new Map<string, NewsItem[]>();
    for (const it of items) {
      const cat = clean(getCategory(it.sourceId)) || "General";
      const arr = map.get(cat) ?? [];
      arr.push(it);
      map.set(cat, arr);
    }
    return map;
  }, [items, getCategory]);

  const cats = [...groups.keys()];
  const [activeCat, setActiveCat] = useState<string>(cats[0]);
  const [sourceFilter, setSourceFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const [aiItem, setAiItem] = useState<NewsItem | null>(null);

  useEffect(() => {
    setPage(1);
    setSourceFilter("ALL");
  }, [activeCat]);

  const sortedItems = useMemo(() => {
    const list = groups.get(activeCat) ?? [];
    return [...list].sort((a, b) =>
      clean(b.publishedAt).localeCompare(clean(a.publishedAt))
    );
  }, [groups, activeCat]);

  const sources = useMemo(() => {
    const map = new Map<string, { id: string; name: string; icon?: string | null }>();
    for (const it of sortedItems) {
      const id = clean(it.sourceId);
      if (!id) continue;
      if (!map.has(id)) {
        map.set(id, {
          id,
          name: clean(it.sourceName) || "Source",
          icon: it.sourceIconUrl,
        });
      }
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [sortedItems]);

  const filtered = useMemo(() => {
    if (sourceFilter === "ALL") return sortedItems;
    return sortedItems.filter((it) => clean(it.sourceId) === sourceFilter);
  }, [sortedItems, sourceFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const canUseAi = (it: NewsItem) => {
    if (!isForeignCategory(activeCat)) return false;
    if (it.kind === 1) return !!clean((it as any)?.summary);
    if (it.kind === 2) return true;
    return false;
  };

  return (
    <Box
      sx={{
        borderRadius: 2,
        overflow: "hidden",
        boxShadow: { xs: 1, md: 2 },
        bgcolor: "common.white",
        border: "1px solid",
        borderColor: "divider",
      }}
    >
      {/* HEADER */}
      <Box sx={{ px: 1.5, pt: 1.25, borderBottom: "1px solid", borderColor: "divider" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="subtitle1" fontWeight={950} sx={{ flex: 1 }}>
            Categories
          </Typography>

          <FormControl size="small" sx={{ minWidth: 220 }}>
            <InputLabel>Source</InputLabel>
            <Select
              value={sourceFilter}
              label="Source"
              onChange={(e: SelectChangeEvent) => setSourceFilter(String(e.target.value))}
              sx={{ borderRadius: 2, fontWeight: 900 }}
            >
              <MenuItem value="ALL">All sources</MenuItem>
              {sources.map((s) => (
                <MenuItem key={s.id} value={s.id}>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar src={s.icon ?? undefined} sx={{ width: 18, height: 18 }} />
                    {s.name}
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Tabs
          value={activeCat}
          onChange={(_, v) => setActiveCat(v)}
          variant="scrollable"
          scrollButtons="auto"
          sx={{ mt: 0.75 }}
        >
          {cats.map((c) => (
            <Tab key={c} value={c} label={c} />
          ))}
        </Tabs>
      </Box>

      {/* GRID */}
      <Box
        sx={{
          p: 1.25,
          display: "grid",
          gap: 1.25,
          gridTemplateColumns: {
            xs: "1fr",
            sm: "repeat(2, 1fr)",
            md: "repeat(4, 1fr)", // ✅ 4 columns unchanged
          },
        }}
      >
        {pageItems.map((it) => {
          const thumb = clean(it.imageUrl) || "/placeholder-news.jpg";
          return (
            <Box
              key={it.id}
              onClick={() => onOpen(it)}
              sx={{
                cursor: "pointer",
                borderRadius: 2,
                border: "1px solid",
                borderColor: "divider",
                overflow: "hidden",
                position: "relative",
                "&:hover": { boxShadow: 1 },
              }}
            >
              {canUseAi(it) && (
                <Chip
                  icon={<AutoAwesomeIcon />}
                  label="AI"
                  size="small"
                  onClick={(e) => {
                    e.stopPropagation();
                    setAiItem(it);
                  }}
                  sx={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    fontWeight: 900,
                    borderRadius: 999,
                    bgcolor: "common.white",
                    zIndex: 2,
                  }}
                />
              )}

              <Box component="img" src={thumb} sx={{ width: "100%", height: 110, objectFit: "cover" }} />

              <Box sx={{ p: 1 }}>
                <Typography variant="body2" fontWeight={950} lineHeight={1.2}>
                  {it.title}
                </Typography>

                <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.75 }}>
                  <Avatar src={it.sourceIconUrl ?? undefined} sx={{ width: 18, height: 18 }} />
                  <Typography variant="caption" color="text.secondary">
                    {it.sourceName}
                  </Typography>
                  <TimeAgo iso={it.publishedAt} variant="caption" />
                </Stack>
              </Box>
            </Box>
          );
        })}
      </Box>

      {filtered.length > PAGE_SIZE && (
        <Box sx={{ px: 2, pb: 2, display: "flex", justifyContent: "flex-end" }}>
          <Pagination
            count={totalPages}
            page={page}
            onChange={(_, v) => setPage(v)}
            size="small"
            shape="rounded"
          />
        </Box>
      )}

      {/* AI MODAL */}
      <Dialog open={!!aiItem} onClose={() => setAiItem(null)} fullWidth maxWidth="md">
        <DialogTitle sx={{ fontWeight: 950 }}>
          Somali Summary
          <IconButton onClick={() => setAiItem(null)} sx={{ position: "absolute", right: 8, top: 8 }}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {aiItem && (
            <AiSomaliSummary
              kind={aiItem.kind === 2 ? 2 : 1}
              title={clean(aiItem.title)}
              url={clean(aiItem.url)}
              sourceName={clean(aiItem.sourceName)}
              summary={clean((aiItem as any)?.summary)}
              autoRun
              runKey={`${aiItem.id}-foreign-ai`}
            />
          )}
        </DialogContent>
      </Dialog>
    </Box>
  );
}