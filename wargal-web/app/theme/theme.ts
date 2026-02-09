"use client";

import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#1565C0" },
    secondary: { main: "#0D47A1" },
    background: {
      default: "#F6F9FF",
      paper: "#FFFFFF",
    },
    divider: "rgba(21, 101, 192, 0.12)",
  },
  typography: {
    fontFamily: "Roboto, system-ui, -apple-system, Segoe UI, Arial, sans-serif",
    h6: { fontWeight: 900 },
    subtitle1: { fontWeight: 800 },
    button: { textTransform: "none", fontWeight: 800 },
  },
  shape: { borderRadius: 14 },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          color: "#0F172A",
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(21, 101, 192, 0.10)",
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid rgba(21, 101, 192, 0.10)",
          boxShadow: "none",
        },
      },
    },
    MuiContainer: {
      defaultProps: { maxWidth: "lg" },
    },
  },
});

export default theme;
