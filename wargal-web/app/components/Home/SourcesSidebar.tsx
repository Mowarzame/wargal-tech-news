"use client";

import {
  Box,
  Typography,
  TextField,
  Button,
  Divider,
  Checkbox,
  Avatar,
} from "@mui/material";
import { useMemo, useState } from "react";
import { NewsSource } from "@/app/types/news";

type Props = {
  sources: NewsSource[];
  selectedIds: string[]; // empty => all
  onChange: (ids: string[]) => void;
};

export default function SourcesSidebar({ sources, selectedIds, onChange }: Props) {
  const [q, setQ] = useState("");

  const selected = useMemo(() => new Set(selectedIds.map(String)), [selectedIds]);

  const activeSorted = useMemo(() => {
    const list = (sources ?? []).filter((s) => s.isActive !== false);
    list.sort((a, b) => {
      const t = (b.trustLevel ?? 0) - (a.trustLevel ?? 0);
      if (t !== 0) return t;
      return (a.name ?? "").toLowerCase().localeCompare((b.name ?? "").toLowerCase());
    });
    return list;
  }, [sources]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return activeSorted;
    return activeSorted.filter((s) => (s.name ?? "").toLowerCase().includes(query));
  }, [activeSorted, q]);

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const clear = () => onChange([]);

  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <Box sx={{ p: 1.5 }}>
        <Typography fontWeight={900}>Sources</Typography>

        <TextField
          size="small"
          placeholder="Search…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          fullWidth
          sx={{ mt: 1 }}
        />

        <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
          <Button
            size="small"
            onClick={clear}
            disabled={selectedIds.length === 0}
          >
            Clear
          </Button>

          <Box sx={{ flex: 1 }} />

          <Typography variant="caption" color="text.secondary" sx={{ alignSelf: "center" }}>
            {selectedIds.length === 0 ? "All" : `${selectedIds.length} selected`}
          </Typography>
        </Box>
      </Box>

      <Divider />

      {/* ✅ Scrollable list area inside fixed sidebar */}
      <Box
        sx={{
          maxHeight: "calc(100vh - 180px)", // adjust if needed
          overflowY: "auto",
          p: 0.5,
        }}
      >
        {filtered.map((s) => {
          const id = String(s.id);
          const checked = selected.has(id);
          const icon = (s.iconUrl ?? "").trim();

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
              <Avatar
                src={icon ? icon : undefined}
                sx={{ width: 26, height: 26 }}
              >
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

        {!filtered.length && (
          <Box sx={{ p: 2 }}>
            <Typography color="text.secondary">No sources found</Typography>
          </Box>
        )}
      </Box>
    </Box>
  );
}
