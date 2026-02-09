"use client";

import { useEffect, useMemo, useState } from "react";
import { Typography, TypographyProps } from "@mui/material";

type Props = {
  iso?: string | null;
  variant?: TypographyProps["variant"];
  color?: TypographyProps["color"];
  sx?: TypographyProps["sx"];
  prefix?: string;
};

function computeTimeAgo(iso?: string | null) {
  const s = (iso ?? "").trim();
  if (!s) return "";

  const dt = new Date(s);
  if (Number.isNaN(dt.getTime())) return "";

  const diffMs = Date.now() - dt.getTime();
  if (diffMs < 0) return "just now";

  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;

  const week = Math.floor(day / 7);
  if (week < 4) return `${week}w ago`;

  const mo = Math.floor(day / 30);
  return `${mo}mo ago`;
}

export default function TimeAgo({
  iso,
  variant = "caption",
  color = "text.secondary",
  sx,
  prefix,
}: Props) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  const text = useMemo(() => computeTimeAgo(iso), [iso]);

  // ✅ avoids SSR/client mismatch
  if (!mounted || !text) return null;

  return (
    <Typography variant={variant} color={color} sx={sx}>
      {prefix ? `${prefix}${text}` : text}
    </Typography>
  );
}
