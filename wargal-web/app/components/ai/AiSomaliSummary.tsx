"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import { summarizeSomali } from "@/app/lib/ai";

type Props = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null;
  sourceName?: string | null;

  // ✅ auto-run
  autoRun?: boolean;
  runKey?: string;
  onLoadingChange?: (loading: boolean) => void;
};

export default function AiSomaliSummary({
  kind,
  title,
  url,
  summary,
  sourceName,
  autoRun = false,
  runKey,
  onLoadingChange
}: Props) {
  const [loading, setLoading] = useState(false);

  // ✅ Keep text visible while loading (do NOT clear it)
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  // ✅ Prevent repeat auto-runs for same item
  const ranRef = useRef<string>("");

  const run = async () => {
    if (loading) return;

    setLoading(true);
    onLoadingChange?.(true);
    setErr("");

    try {
      const r = await summarizeSomali({ kind, title, url, summary, sourceName });
      setText((r?.summary ?? "").trim());
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
      onLoadingChange?.(false);
    }
  };

  // ✅ auto-generate ONLY once per runKey (or per stable fallback key)
  useEffect(() => {
    if (!autoRun) return;

    const k = String(runKey || `${kind}:${title}:${url}`);
    if (ranRef.current === k) return;

    ranRef.current = k;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, runKey, kind, title, url]);

  return (
    <Box sx={{ mt: 0 }}>
      {/* Manual trigger (still available) */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={run}
          disabled={loading}
          sx={{ textTransform: "none", fontWeight: 900, borderRadius: 999 }}
        >
          {/* ✅ No spinner + no "AI..." label */}
          Soo koob (AI)
        </Button>
      </Box>

      {err && (
        <Typography variant="body2" color="error" sx={{ mt: 1, whiteSpace: "pre-wrap" }}>
          {err}
        </Typography>
      )}

      {text && (
        <Box
          sx={{
            mt: 1,
            p: 1.25,
            borderRadius: 2,
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "#fff",
          }}
        >
          <Typography variant="body2" sx={{ whiteSpace: "pre-wrap" }}>
            {text}
          </Typography>
        </Box>
      )}
    </Box>
  );
}