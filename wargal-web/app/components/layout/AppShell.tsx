"use client";

import {
  AppBar,
  Toolbar,
  Typography,
  Container,
  Box,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Menu,
  MenuItem,
  Button,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import BoltIcon from "@mui/icons-material/Bolt";
import NewspaperIcon from "@mui/icons-material/Newspaper";
import GroupsIcon from "@mui/icons-material/Groups";
import SettingsIcon from "@mui/icons-material/Settings";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import AccountCircleIcon from "@mui/icons-material/AccountCircle";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type NavItem = {
  label: string;
  href: string;
  icon: React.ReactNode;
  breaking?: boolean;
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  const navItems: NavItem[] = [
    { label: "Breaking", href: "/breaking", icon: <BoltIcon />, breaking: true },
    { label: "News", href: "/news", icon: <NewspaperIcon /> },
    { label: "Community", href: "/community", icon: <GroupsIcon /> },
  ];

  const isActive = (href: string) =>
    pathname === href || pathname?.startsWith(href + "/");

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default" }}>
      {/* AppBar */}
      <AppBar position="sticky" elevation={0}>
        <Container>
          <Toolbar disableGutters sx={{ height: 64 }}>
            <IconButton
              onClick={() => setDrawerOpen(true)}
              sx={{ display: { xs: "inline-flex", md: "none" }, mr: 1 }}
            >
              <MenuIcon />
            </IconButton>

            <Typography
              component={Link}
              href="/"
              variant="h6"
              sx={{
                textDecoration: "none",
                color: "inherit",
                fontWeight: 900,
                mr: 3,
              }}
            >
              Wargal
            </Typography>

            {/* Desktop nav */}
            <Box sx={{ display: { xs: "none", md: "flex" }, gap: 1 }}>
              {navItems.map((item) => (
                <Button
                  key={item.href}
                  component={Link}
                  href={item.href}
                  startIcon={item.icon}
                  sx={{
                    borderRadius: 999,
                    px: 1.6,
                    color: item.breaking ? "error.main" : "primary.main",
                    bgcolor: isActive(item.href)
                      ? "rgba(21,101,192,0.10)"
                      : "transparent",
                    border: isActive(item.href)
                      ? "1px solid rgba(21,101,192,0.2)"
                      : "1px solid transparent",
                  }}
                >
                  {item.label}
                </Button>
              ))}
            </Box>

            <Box sx={{ flexGrow: 1 }} />

            {/* Avatar */}
            <IconButton onClick={(e) => setMenuAnchor(e.currentTarget)}>
              <AccountCircleIcon />
            </IconButton>

            <Menu
              anchorEl={menuAnchor}
              open={Boolean(menuAnchor)}
              onClose={() => setMenuAnchor(null)}
            >
              <MenuItem component={Link} href="/profile">
                Profile
              </MenuItem>
              <MenuItem component={Link} href="/settings">
                Settings
              </MenuItem>
              <Divider />
              <MenuItem sx={{ color: "error.main" }}>Logout</MenuItem>
            </Menu>
          </Toolbar>
        </Container>
      </AppBar>

      {/* Drawer (mobile) */}
      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)}>
        <Box sx={{ width: 280 }}>
          <List>
            {navItems.map((item) => (
              <ListItemButton
                key={item.href}
                component={Link}
                href={item.href}
                selected={isActive(item.href)}
                onClick={() => setDrawerOpen(false)}
              >
                <ListItemIcon
                  sx={{ color: item.breaking ? "error.main" : "inherit" }}
                >
                  {item.icon}
                </ListItemIcon>
                <ListItemText primary={item.label} />
              </ListItemButton>
            ))}
          </List>

          <Divider />

          <List>
            <ListItemButton component={Link} href="/settings">
              <ListItemIcon>
                <SettingsIcon />
              </ListItemIcon>
              <ListItemText primary="Settings" />
            </ListItemButton>

            <ListItemButton component={Link} href="/about">
              <ListItemIcon>
                <InfoOutlinedIcon />
              </ListItemIcon>
              <ListItemText primary="About" />
            </ListItemButton>
          </List>
        </Box>
      </Drawer>

      {/* Content */}
      <Container sx={{ py: 3 }}>{children}</Container>
    </Box>
  );
}
