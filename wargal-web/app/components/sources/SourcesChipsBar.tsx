"use client";

import {
  Box,
  Tooltip,
  Avatar,
  Button,
  Drawer,
  TextField,
  Divider,
  Checkbox,
  Typography,
  Stack,
} from "@mui/material";
import TuneIcon from "@mui/icons-material/Tune";
import SearchIcon from "@mui/icons-material/Search";
import { useMemo, useState } from "react";
import { NewsSource } from "@/app/types/news";

type Props = {
  sources: NewsSource[];
  selectedIds: string[];              // empty => All
  onChangeSelected: (ids: string[]) => void;
};

export default function SourcesChipsBar({
  sources,
  selectedIds,
  onChangeSelected,
}: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");

  const active = useMemo(
    () => (sources ?? []).filter((s) => s.isActive !== false),
    [sources]
  );

  // Sort like mobile: trust desc then name
  const sorted = useMemo(() => {
    const list = [...active];
    list.sort((a, b) => {
      const t = (b.trustLevel ?? 0) - (a.trustLevel ?? 0);
      if (t !== 0) return t;
      return (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase());
    });
    return list;
  }, [active]);

  const selected = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const isAllSelected = selectedIds.length === 0;

  const selectOnly = (id: string | null) => {
    if (!id) onChangeSelected([]);          // All
    else onChangeSelected([String(id)]);    // single
  };

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChangeSelected(Array.from(next));
  };

  // show first N icons in chips row
  const shown = sorted.slice(0, 10);

  // drawer search filter
  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return sorted;
    return sorted.filter((s) => (s.name ?? "").toLowerCase().includes(query));
  }, [sorted, q]);

  return (
    <>
      {/* ✅ Pinned chips row */}
      <Box
        sx={{
          position: "sticky",
          top: 0,
          zIndex: 20,
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
          py: 1,
          px: { xs: 1.5, md: 2 },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Box
            sx={{
              overflowX: "auto",
              display: "flex",
              alignItems: "center",
              gap: 1,
              flex: 1,
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {/* All chip */}
            <IconChip
              tooltip="All sources"
              selected={isAllSelected}
              imageUrl={null}
              fallbackLetter="A"
              onClick={() => selectOnly(null)}
            />

            {shown.map((s) => {
              const selectedSingle =
                selectedIds.length === 1 && selected.has(String(s.id));
              return (
                <IconChip
                  key={s.id}
                  tooltip={s.name}
                  selected={selectedSingle}
                  imageUrl={s.iconUrl ?? null}
                  fallbackLetter={(s.name?.[0] ?? "S").toUpperCase()}
                  onClick={() => selectOnly(String(s.id))}
                />
              );
            })}
          </Box>

          <Button
            variant="outlined"
            onClick={() => setOpen(true)}
            startIcon={<TuneIcon />}
            sx={{ height: 36, borderRadius: 2, flexShrink: 0 }}
          >
            {selectedIds.length === 0 ? "Sources" : `${selectedIds.length}`}
          </Button>
        </Box>
      </Box>

      {/* ✅ Drawer picker (like bottom sheet) */}
      <Drawer anchor="right" open={open} onClose={() => setOpen(false)}>
        <Box sx={{ width: 360, p: 2 }}>
          <Typography variant="h6" fontWeight={900}>
            Sources
          </Typography>

          <TextField
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search sources…"
            fullWidth
            size="small"
            sx={{ mt: 1.5 }}
            InputProps={{
              startAdornment: <SearchIcon fontSize="small" style={{ marginRight: 8 }} />,
            }}
          />

          <Stack direction="row" sx={{ mt: 1.5 }} spacing={1}>
            <Button
              onClick={() => onChangeSelected([])}
              disabled={selectedIds.length === 0}
            >
              Clear
            </Button>
            <Box sx={{ flex: 1 }} />
            <Button variant="contained" onClick={() => setOpen(false)}>
              Apply
            </Button>
          </Stack>

          <Divider sx={{ my: 1.5 }} />

          <Box sx={{ maxHeight: "75vh", overflow: "auto" }}>
            {filtered.map((s) => {
              const id = String(s.id);
              const checked = selected.has(id);

              return (
                <Box
                  key={id}
                  onClick={() => toggle(id)}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    px: 1,
                    py: 1,
                    borderRadius: 2,
                    cursor: "pointer",
                    "&:hover": { bgcolor: "grey.50" },
                  }}
                >
                  <Avatar src={s.iconUrl ?? undefined} sx={{ width: 28, height: 28 }}>
                    {(s.name?.[0] ?? "S").toUpperCase()}
                  </Avatar>

                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography fontWeight={800} noWrap>
                      {s.name}
                    </Typography>
                    {!!s.category && (
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {s.category}
                      </Typography>
                    )}
                  </Box>

                  <Checkbox checked={checked} />
                </Box>
              );
            })}
          </Box>
        </Box>
      </Drawer>
    </>
  );
}

function IconChip({
  tooltip,
  selected,
  imageUrl,
  fallbackLetter,
  onClick,
}: {
  tooltip: string;
  selected: boolean;
  imageUrl: string | null;
  fallbackLetter: string;
  onClick: () => void;
}) {
  const url = (imageUrl ?? "").trim();
  return (
    <Tooltip title={tooltip}>
      <Box
        onClick={onClick}
        sx={{
          cursor: "pointer",
          borderRadius: "999px",
          p: 0.25,
          border: "2px solid",
          borderColor: selected ? "primary.main" : "transparent",
          flexShrink: 0,
        }}
      >
        <Avatar
          src={url ? url : undefined}
          sx={{ width: 34, height: 34, bgcolor: "grey.200", fontWeight: 900 }}
        >
          {!url ? fallbackLetter : null}
        </Avatar>
      </Box>
    </Tooltip>
  );
}
