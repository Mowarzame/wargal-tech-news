// app/components/ai/AiSomaliSummary.tsx (core hybrid logic)
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Typography } from "@mui/material";

function clean(s?: string | null) {
  return (s ?? "").trim();
}

function extractYoutubeId(url: string): string | null {
  try {
    const u = new URL(url);

    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "").trim();
      return id || null;
    }

    if (u.hostname.includes("youtube.com")) {
      const v = u.searchParams.get("v");
      if (v) return v;

      const parts = u.pathname.split("/").filter(Boolean);
      const embedIdx = parts.indexOf("embed");
      if (embedIdx >= 0 && parts[embedIdx + 1]) return parts[embedIdx + 1];

      const shortsIdx = parts.indexOf("shorts");
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }

    return null;
  } catch {
    return null;
  }
}

type Props = {
  kind: 1 | 2;
  title: string;
  url: string;
  summary?: string | null;      // ✅ for videos this is typically description/snippet
  sourceName?: string | null;
  category?: string | null;     // ✅ you already pass aiCategory
  autoRun?: boolean;
  runKey?: string;
  onLoadingChange?: (v: boolean) => void;
};

export default function AiSomaliSummary(props: Props) {
  const {
    kind,
    title,
    url,
    summary,
    sourceName,
    category,
    autoRun = true,
    runKey,
    onLoadingChange,
  } = props;

  const [text, setText] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string>("");

  const isForeignNewsVideo = kind === 2 && clean(category) === "ForeignNews";

  const ytId = useMemo(() => {
    const u = clean(url);
    if (!u) return null;
    return extractYoutubeId(u);
  }, [url]);

  const setBusy = (v: boolean) => {
    setLoading(v);
    onLoadingChange?.(v);
  };

  const buildHybridContent = async (): Promise<string> => {
    const t = clean(title);
    const u = clean(url);
    const desc = clean(summary);

    // ✅ Only attempt transcript for ForeignNews videos
    if (isForeignNewsVideo && ytId) {
      try {
        // If your transcript API is GET, switch to: `/api/youtube/transcript?videoId=${ytId}`
        const r = await fetch("/api/youtube/transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId: ytId, url: u }),
        });

        if (r.ok) {
          const data = await r.json().catch(() => null);
          const transcript = clean(data?.transcript || data?.text);
          if (transcript && transcript.length >= 80) {
            return transcript; // ✅ best source
          }
        }
      } catch {
        // ignore → fallback below
      }
    }

    // ✅ Fallback = description + title
    if (desc) return `${t}\n\n${desc}`.trim();

    // ✅ Final fallback = title only (still allowed)
    return t || u;
  };

  const generate = async () => {
    setErr("");
    setText("");
    setBusy(true);

    try {
      const u = clean(url);
      const t = clean(title);

      const content = await buildHybridContent();

      const resp = await fetch("/api/ai/somali-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          title: t,
          url: u,
          sourceName: clean(sourceName),
          summary: content, // ✅ send hybrid content via same field
        }),
      });

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(clean(json?.error) || "Request failed");
      }

      setText(clean(json?.summary) || "");
    } catch (e: any) {
      setErr(e?.message ?? "Failed");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (!autoRun) return;
    // runKey controls re-run
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  return (
    <Box>
      {/* ✅ Keep button if you want manual regenerate, otherwise remove */}
      <Button onClick={generate} disabled={loading} variant="contained" sx={{ fontWeight: 900, borderRadius: 2 }}>
        Soo koob (AI)
      </Button>

      {!!err && (
        <Typography sx={{ mt: 1 }} color="error" fontWeight={800}>
          {err}
        </Typography>
      )}

      {!!text && (
        <Typography sx={{ mt: 1.5, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
          {text}
        </Typography>
      )}
    </Box>
  );
}