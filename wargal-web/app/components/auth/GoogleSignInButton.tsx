"use client";

import * as React from "react";
import { Box, Typography } from "@mui/material";

declare global {
  interface Window {
    google?: any;
  }
}

function decodeJwtPayload(credential: string): any | null {
  try {
    const parts = credential.split(".");
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export default function GoogleSignInButton({
  onSignedIn,
}: {
  onSignedIn: (profile: { name: string; email: string; picture?: string | null }) => void;
}) {
  const divRef = React.useRef<HTMLDivElement | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  React.useEffect(() => {
    const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
    if (!clientId) {
      setErr("Missing NEXT_PUBLIC_GOOGLE_CLIENT_ID");
      return;
    }

    let cancelled = false;

    const init = () => {
      if (cancelled) return;
      if (!window.google?.accounts?.id || !divRef.current) return;

      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: (resp: any) => {
          const credential = String(resp?.credential || "");
          const payload = decodeJwtPayload(credential);

          const name = String(payload?.name || "");
          const email = String(payload?.email || "");
          const picture = payload?.picture ? String(payload.picture) : null;

          if (!name || !email) {
            setErr("Google sign-in returned incomplete profile.");
            return;
          }

          onSignedIn({ name, email, picture });
        },
      });

      // Clear any old button and render
      divRef.current.innerHTML = "";
      window.google.accounts.id.renderButton(divRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 280,
        text: "signin_with",
      });
    };

    // GIS loads async; poll until ready
    const id = window.setInterval(() => {
      if (window.google?.accounts?.id) {
        window.clearInterval(id);
        init();
      }
    }, 50);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [onSignedIn]);

  return (
    <Box>
      <Box ref={divRef} />
      {!!err && (
        <Typography color="error" sx={{ mt: 1, fontWeight: 800, textAlign: "center" }}>
          {err}
        </Typography>
      )}
    </Box>
  );
}
