// app/components/ai/AiSomaliSummary.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
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
  summary?: string | null; // for videos: description/snippet
  sourceName?: string | null;
  category?: string | null; // passed aiCategory
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

  // captions upgrade UI
  const [hasCaptions, setHasCaptions] = useState(false);
  const [captions, setCaptions] = useState<string>("");
  const [capsLoading, setCapsLoading] = useState(false);

  // local cache (per session)
  const memCacheRef = useRef<Map<string, string>>(new Map());

  // in-flight guard
  const inFlightRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

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

  const baseContent = useMemo(() => {
    const t = clean(title);
    const desc = clean(summary);
    if (desc) return `${t}\n\n${desc}`.trim();
    return t || clean(url);
  }, [title, summary, url]);

  const requestKey = useMemo(() => {
    // stable cache key (fast)
    return `${kind}::${clean(url)}::${clean(title)}::${clean(sourceName)}::${baseContent.length}`;
  }, [kind, url, title, sourceName, baseContent.length]);

  const generateWithContent = async (content: string, cacheKey: string) => {
    // session cache hit
    const cached = memCacheRef.current.get(cacheKey);
    if (cached) {
      setErr("");
      setText(cached);
      return;
    }

    // prevent duplicates
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    // abort previous
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setErr("");
    setText("");
    setBusy(true);

    try {
      const resp = await fetch("/api/ai/somali-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: ac.signal,
        body: JSON.stringify({
          kind,
          title: clean(title),
          url: clean(url),
          sourceName: clean(sourceName),
          summary: content, // hybrid field
        }),
      });

      const json = await resp.json().catch(() => null);

      if (!resp.ok) {
        throw new Error(clean(json?.error) || "Request failed");
      }

      const out = clean(json?.summary) || "";
      setText(out);
      memCacheRef.current.set(cacheKey, out);
    } catch (e: any) {
      // ignore abort errors
      const msg = String(e?.message ?? "Failed");
      if (!msg.toLowerCase().includes("abort")) setErr(msg);
    } finally {
      setBusy(false);
      inFlightRef.current = false;
    }
  };

  const fetchCaptions = async () => {
    if (!isForeignNewsVideo || !ytId) return "";

    setCapsLoading(true);
    try {
      const r = await fetch("/api/youtube/transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoId: ytId, url: clean(url) }),
      });

      if (!r.ok) return "";

      const data = await r.json().catch(() => null);
      const transcript = clean(data?.transcript || data?.text);

      if (transcript && transcript.length >= 80) {
        setHasCaptions(true);
        setCaptions(transcript);
        return transcript;
      }

      return "";
    } catch {
      return "";
    } finally {
      setCapsLoading(false);
    }
  };

  const generateFast = async () => {
    // FAST FIRST: title + description immediately
    await generateWithContent(baseContent, requestKey);

    // Then fetch captions in background (does not block)
    // Only for ForeignNews YouTube
    if (isForeignNewsVideo && ytId) {
      void fetchCaptions();
    }
  };

  const improveWithCaptions = async () => {
    const cap = captions || (await fetchCaptions());
    if (!cap) return;

    // keep it bounded (huge transcripts slow tokens)
    const trimmed = cap.length > 12000 ? cap.slice(0, 12000) : cap;

    const upgradedContent = `${baseContent}\n\nCAPTIONS:\n${trimmed}`.trim();
    const upgradedKey = `${requestKey}::caps::${trimmed.length}`;

    await generateWithContent(upgradedContent, upgradedKey);
  };

  useEffect(() => {
    if (!autoRun) return;

    // reset state on run changes
    setErr("");
    setText("");
    setHasCaptions(false);
    setCaptions("");
    setCapsLoading(false);

    generateFast();

    return () => {
      abortRef.current?.abort();
      inFlightRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey]);

  return (
    <Box>
      {/* ✅ Show only useful actions */}
      <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Button
          onClick={generateFast}
          disabled={loading}
          variant="contained"
          sx={{ fontWeight: 900, borderRadius: 2 }}
        >
          Soo koob (AI)
        </Button>

        {/* ✅ Optional upgrade button (ForeignNews YouTube only) */}
        {isForeignNewsVideo ? (
          <Button
            onClick={improveWithCaptions}
            disabled={loading || capsLoading}
            variant="outlined"
            sx={{ fontWeight: 900, borderRadius: 2 }}
          >
            {capsLoading ? "Checking captions…" : hasCaptions ? "Improve with captions" : "Try captions"}
          </Button>
        ) : null}
      </Box>

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

      {/* tiny helper text */}
      {!text && !err && (
        <Typography variant="caption" sx={{ mt: 1, display: "block" }} color="text.secondary" fontWeight={800}>
          {loading ? "Generating…" : "Ready."}
        </Typography>
      )}
    </Box>
  );
}