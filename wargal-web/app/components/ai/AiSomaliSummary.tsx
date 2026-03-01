"use client";

import { useEffect, useRef, useState } from "react";
import { Box, Button, CircularProgress, Typography } from "@mui/material";
import { summarizeSomali } from "@/app/lib/ai";

type Props = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null;
  sourceName?: string | null;

  // ✅ new
  autoRun?: boolean;
  runKey?: string;
};

export default function AiSomaliSummary({
  kind,
  title,
  url,
  summary,
  sourceName,
  autoRun = false,
  runKey,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState("");
  const [err, setErr] = useState("");

  const ranRef = useRef<string>("");

  const run = async () => {
    if (loading) return;
    setLoading(true);
    setErr("");
    setText("");

    try {
      const r = await summarizeSomali({ kind, title, url, summary, sourceName });
      setText(r.summary);
    } catch (e: any) {
      setErr(e?.message ?? "Error");
    } finally {
      setLoading(false);
    }
  };

  // ✅ auto-generate when modal opens / item changes
  useEffect(() => {
    if (!autoRun) return;

    const k = String(runKey || `${kind}:${title}:${url}`);
    if (ranRef.current === k) return;

    ranRef.current = k;
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRun, runKey, kind, title, url]);

  return (
    <Box sx={{ mt: 1 }}>
      {/* Manual trigger (still available) */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={run}
          disabled={loading}
          sx={{ textTransform: "none", fontWeight: 900 }}
        >
          {loading ? "AI..." : "Soo koob (AI)"}
        </Button>
        {loading && <CircularProgress size={18} />}
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