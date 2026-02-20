"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  AppBar,
  Avatar,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Menu,
  MenuItem,
  Skeleton,
  Tab,
  Tabs,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import MenuIcon from "@mui/icons-material/Menu";
import CloseIcon from "@mui/icons-material/Close";
import { useTheme } from "@mui/material/styles";

import { fetchFeedSources } from "@/app/lib/api";
import type { NewsSource } from "@/app/types/news";
import { useAuth } from "@/app/providers/AuthProvider";
import GoogleSignInButton from "@/app/components/auth/GoogleSignInButton";

const REFRESH_MS = 60 * 1000;

function clean(s?: string | null) {
  return (s ?? "").trim();
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const { isReady, isAuthed, user, logout, loginWithGoogleProfile } = useAuth();

  const [sources, setSources] = React.useState<NewsSource[]>([]);
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [loginError, setLoginError] = React.useState<string | null>(null);
  const [loginHint, setLoginHint] = React.useState<string | null>(null);

  // user menu (desktop)
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const menuOpen = Boolean(anchorEl);

  // mobile hamburger drawer
  const [drawerOpen, setDrawerOpen] = React.useState(false);

  React.useEffect(() => {
    let alive = true;

    async function load() {
      try {
        const list = await fetchFeedSources();
        if (!alive) return;

        const active = (list ?? [])
          .filter((s) => s?.isActive !== false)
          .sort((a, b) => (b?.trustLevel ?? 0) - (a?.trustLevel ?? 0));

        setSources(active);
      } catch {
        // ignore
      }
    }

    load();
    const id = setInterval(load, REFRESH_MS);

    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const tabValue = React.useMemo(() => {
    if (pathname?.startsWith("/community")) return "/community";
    if (pathname?.startsWith("/contact")) return "/contact";
    return "/";
  }, [pathname]);

  const openLogin = (hint?: string | null) => {
    setLoginError(null);
    setLoginHint(hint ?? null);
    setLoginOpen(true);
  };

  const closeLogin = () => {
    setLoginOpen(false);
    setLoginError(null);
    setLoginHint(null);
  };

  const onOpenMenu = (e: React.MouseEvent<HTMLElement>) => setAnchorEl(e.currentTarget);
  const onCloseMenu = () => setAnchorEl(null);

  const doLogout = () => {
    onCloseMenu();
    logout();
    router.push("/");
  };

  const openDrawer = () => setDrawerOpen(true);
  const closeDrawer = () => setDrawerOpen(false);

  const doLogoutMobile = () => {
    closeDrawer();
    logout();
    router.push("/");
  };

  const doNav = (to: string) => {
    closeDrawer();
    router.push(to);
  };

  const go = (path: string) => {
    // ✅ Gate community access behind auth
    if (path === "/community" && isReady && !isAuthed) {
      openLogin("Sign-in is required to access the Community page.");
      return;
    }
    router.push(path);
  };

  const onTabChange = (_: any, v: string) => go(v);

  const goCommunityFromMenu = () => {
    onCloseMenu();
    if (isReady && !isAuthed) {
      openLogin("Sign-in is required to access the Community page.");
      return;
    }
    router.push("/community");
  };

  const goCommunityFromDrawer = () => {
    closeDrawer();
    if (isReady && !isAuthed) {
      openLogin("Sign-in is required to access the Community page.");
      return;
    }
    router.push("/community");
  };

  // ✅ Always reserve a stable right-side width to prevent navbar shifting on reload/hydration
  const RIGHT_WIDTH_DESKTOP = 170; // sign-in button / avatar area
  const RIGHT_WIDTH_MOBILE = 56; // hamburger or avatar+hamburger

  return (
    <AppBar position="sticky" elevation={0} sx={{ height: 64 }}>
      <Toolbar sx={{ minHeight: "64px !important", height: 64, gap: 2 }}>
        {/* Left: Logo */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.2 }}>
          <Box
            component={Link}
            href="/"
            prefetch
            onClick={() => window.scrollTo({ top: 0, left: 0, behavior: "smooth" })}
            sx={{ display: "inline-flex", alignItems: "center" }}
            aria-label="Go to home"
          >
            <Box
              component="img"
              src="/images/logo/correctLogo2.png"
              alt="Wargal"
              sx={{ width: 70, height: 70, borderRadius: 1, cursor: "pointer" }}
              draggable={false}
            />
          </Box>
        </Box>

        {/* Center: marquee */}
        <Box sx={{ flex: 1, display: "flex", justifyContent: "center", minWidth: 0 }}>
          <SourcesMarquee sources={sources} />
        </Box>

        {/* Desktop tabs (md+ only, always show) */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", minWidth: 0 }}>
          <Tabs
            value={tabValue}
            onChange={onTabChange}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{
              minHeight: 40,
              "& .MuiTab-root": { minHeight: 40, textTransform: "none", fontWeight: 900 },
            }}
          >
            <Tab label="News" value="/" />
            <Tab label="Community" value="/community" />
            <Tab label="Contact" value="/contact" />
          </Tabs>
        </Box>

        {/* Right: ALWAYS render same structure/width (prevents layout jump on reload) */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            width: { xs: RIGHT_WIDTH_MOBILE, md: RIGHT_WIDTH_DESKTOP },
            justifyContent: "flex-end",
            flexShrink: 0,
          }}
        >
          {!isReady ? (
            <>
              {/* Desktop skeleton */}
              <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
                <Skeleton variant="rounded" width={110} height={32} sx={{ borderRadius: 999 }} />
                <Skeleton variant="circular" width={32} height={32} />
              </Box>

              {/* Mobile skeleton */}
              <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1 }}>
                <Skeleton variant="circular" width={32} height={32} />
              </Box>
            </>
          ) : !isAuthed ? (
            <>
              {/* Desktop: Sign in button */}
              <Button
                variant="contained"
                onClick={() => openLogin(null)}
                sx={{
                  display: { xs: "none", md: "inline-flex" },
                  textTransform: "none",
                  fontWeight: 900,
                  borderRadius: 999,
                  height: 32,
                }}
              >
                Sign in
              </Button>

              {/* Desktop: placeholder avatar slot to keep footprint identical */}
              <Box sx={{ display: { xs: "none", md: "inline-flex" } }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: "rgba(255,255,255,0.25)" }}>?</Avatar>
              </Box>

              {/* Mobile: hamburger */}
              <IconButton
                onClick={openDrawer}
                sx={{ display: { xs: "inline-flex", md: "none" }, color: "common.white" }}
                aria-label="Open menu"
              >
                <MenuIcon />
              </IconButton>
            </>
          ) : (
            <>
              {/* Desktop: user menu (avatar always 32x32) */}
              <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 1 }}>
                <IconButton onClick={onOpenMenu} sx={{ color: "common.white" }} aria-label="Open user menu">
                  {clean(user?.profilePictureUrl) ? (
                    <Avatar src={user?.profilePictureUrl ?? undefined} sx={{ width: 32, height: 32 }} />
                  ) : (
                    <Avatar sx={{ width: 32, height: 32, bgcolor: "rgba(255,255,255,0.25)" }}>
                      {(clean(user?.name)?.[0] ?? "U").toUpperCase()}
                    </Avatar>
                  )}
                </IconButton>

                <Menu anchorEl={anchorEl} open={menuOpen} onClose={onCloseMenu}>
                  <MenuItem disabled>
                    <Box sx={{ minWidth: 220 }}>
                      <Typography fontWeight={900} noWrap>
                        {user?.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {user?.email} · {user?.role}
                      </Typography>
                    </Box>
                  </MenuItem>

                  <MenuItem
                    onClick={() => {
                      onCloseMenu();
                      router.push("/");
                    }}
                    sx={{ fontWeight: 900 }}
                  >
                    News
                  </MenuItem>
                  <MenuItem onClick={goCommunityFromMenu} sx={{ fontWeight: 900 }}>
                    Community
                  </MenuItem>
                  <MenuItem
                    onClick={() => {
                      onCloseMenu();
                      router.push("/contact");
                    }}
                    sx={{ fontWeight: 900 }}
                  >
                    Contact
                  </MenuItem>

                  <Divider sx={{ my: 0.5 }} />

                  <MenuItem onClick={doLogout} sx={{ fontWeight: 900 }}>
                    Logout
                  </MenuItem>
                </Menu>
              </Box>

              {/* Mobile: avatar + hamburger (fixed footprint) */}
              <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 1 }}>
                {clean(user?.profilePictureUrl) ? (
                  <Avatar src={user?.profilePictureUrl ?? undefined} sx={{ width: 32, height: 32 }} />
                ) : (
                  <Avatar sx={{ width: 32, height: 32 }}>
                    {(clean(user?.name)?.[0] ?? "U").toUpperCase()}
                  </Avatar>
                )}

                <IconButton onClick={openDrawer} sx={{ color: "common.white" }} aria-label="Open menu">
                  <MenuIcon />
                </IconButton>
              </Box>
            </>
          )}
        </Box>
      </Toolbar>

      {/* ✅ Mobile hamburger drawer */}
      <Drawer
        open={drawerOpen}
        onClose={closeDrawer}
        anchor="right"
        PaperProps={{ sx: { width: { xs: "86vw", sm: 340 }, maxWidth: "100%" } }}
      >
        <Box sx={{ p: 1.5, display: "flex", alignItems: "center", gap: 1 }}>
          <Typography fontWeight={950} sx={{ flex: 1 }}>
            Menu
          </Typography>
          <IconButton onClick={closeDrawer} aria-label="Close menu">
            <CloseIcon />
          </IconButton>
        </Box>

        <Divider />

        <List sx={{ py: 0 }}>
          <ListItemButton onClick={() => doNav("/")}>
            <ListItemText primary="News" primaryTypographyProps={{ fontWeight: 900 }} />
          </ListItemButton>

          <ListItemButton onClick={goCommunityFromDrawer}>
            <ListItemText primary="Community" primaryTypographyProps={{ fontWeight: 900 }} />
          </ListItemButton>

          <ListItemButton onClick={() => doNav("/contact")}>
            <ListItemText primary="Contact" primaryTypographyProps={{ fontWeight: 900 }} />
          </ListItemButton>

          <Divider />

          {!isReady ? (
            <Box sx={{ px: 2, py: 1.5 }}>
              <Skeleton variant="text" width={140} />
              <Skeleton variant="text" width={220} />
            </Box>
          ) : !isAuthed ? (
            <ListItemButton
              onClick={() => {
                closeDrawer();
                openLogin(null);
              }}
            >
              <ListItemText primary="Sign in" primaryTypographyProps={{ fontWeight: 900 }} />
            </ListItemButton>
          ) : (
            <>
              <Box sx={{ px: 2, py: 1.25 }}>
                <Typography fontWeight={950} noWrap>
                  {clean(user?.name) || "User"}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap>
                  {clean(user?.email)} · {clean(user?.role)}
                </Typography>
              </Box>

              <ListItemButton onClick={doLogoutMobile}>
                <ListItemText primary="Logout" primaryTypographyProps={{ fontWeight: 900 }} />
              </ListItemButton>
            </>
          )}
        </List>

        <Box sx={{ p: 2 }}>
          <Typography variant="caption" color="text.secondary">
            Wargal News · Somali tech/news aggregator + community
          </Typography>
        </Box>
      </Drawer>

      {/* Google sign-in dialog */}
      <Dialog open={loginOpen} onClose={closeLogin} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 950 }}>Sign in with Google</DialogTitle>
        <DialogContent sx={{ pt: 1 }}>
          <Typography variant="caption" color="text.secondary">
            {loginHint ?? "Wargal News — the first Somali news aggregator."}
          </Typography>

          <Box sx={{ mt: 2, display: "flex", justifyContent: "center" }}>
            <GoogleSignInButton
              onSignedIn={async (profile) => {
                setLoginError(null);
                try {
                  await loginWithGoogleProfile(profile);
                  setLoginOpen(false);
                  setLoginHint(null);
                  router.push("/community");
                } catch (e: any) {
                  setLoginError(e?.message ?? "Login failed");
                }
              }}
            />
          </Box>

          {!!loginError && (
            <Typography color="error" sx={{ mt: 2, fontWeight: 800, textAlign: "center" }}>
              {loginError}
            </Typography>
          )}
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={closeLogin} sx={{ textTransform: "none", fontWeight: 900 }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </AppBar>
  );
}

function SourcesMarquee({ sources }: { sources: NewsSource[] }) {
  const icons = sources.filter((s) => (s.iconUrl ?? "").trim().length > 0);
  if (!icons.length) return null;

  return (
    <Box
      sx={{
        position: "relative",
        width: { xs: "100%", md: 520 },
        maxWidth: "100%",
        height: 40,
        overflow: "hidden",
        borderRadius: 999,
        minWidth: 0,
      }}
    >
      {/* Fade masks */}
      <Box
        sx={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 44,
          zIndex: 2,
          pointerEvents: "none",
          background: "linear-gradient(to right, rgba(21,101,192,1), rgba(21,101,192,0))",
        }}
      />
      <Box
        sx={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: 44,
          zIndex: 2,
          pointerEvents: "none",
          background: "linear-gradient(to left, rgba(21,101,192,1), rgba(21,101,192,0))",
        }}
      />

      {/* Track */}
      <Box sx={{ position: "absolute", inset: 0, display: "flex", alignItems: "center" }}>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: { xs: 0.9, sm: 1.2 },
            pr: 2,
            animation: "wargalMarquee 22s linear infinite",
            "@keyframes wargalMarquee": {
              "0%": { transform: "translateX(0)" },
              "100%": { transform: "translateX(-50%)" },
            },
            width: "max-content",
          }}
        >
          {[...icons, ...icons].map((s, idx) => (
            <Avatar
              key={`${s.id}-${idx}`}
              src={(s.iconUrl ?? "").trim() || undefined}
              alt={s.name}
              sx={{
                width: { xs: 26, sm: 28 },
                height: { xs: 26, sm: 28 },
                bgcolor: "rgba(255,255,255,0.25)",
                border: "1px solid rgba(255,255,255,0.35)",
              }}
              imgProps={{ draggable: false }}
            />
          ))}
        </Box>
      </Box>
    </Box>
  );
}