import { createTheme } from "@mui/material/styles";

export const MONOSPACE_FONT_FAMILY =
  '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';

export const CODE_SURFACE_TOKENS = {
  background: "#0f172a",
  foreground: "#f8fafc",
  mutedForeground: "#e2e8f0",
  inlineBackground: "#f1f5f9",
  inlineBorder: "#e2e8f0",
} as const;

export const appTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#1a73e8",
      dark: "#1557b0",
      light: "#e8f0fe",
    },
    secondary: {
      main: "#00796b",
      dark: "#004d40",
      light: "#e0f2f1",
    },
    background: {
      default: "#f8fafc",
      paper: "#ffffff",
    },
    divider: "#e2e8f0",
    success: {
      main: "#1e8e3e",
    },
    warning: {
      main: "#f9ab00",
    },
    error: {
      main: "#d93025",
    },
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    h5: {
      fontWeight: 700,
      letterSpacing: "-0.01em",
    },
    h6: {
      fontWeight: 600,
      letterSpacing: "-0.01em",
    },
    subtitle1: {
      fontWeight: 600,
    },
    button: {
      textTransform: "none",
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 10,
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        code: {
          fontFamily: MONOSPACE_FONT_FAMILY,
          fontSize: "0.84em",
          backgroundColor: CODE_SURFACE_TOKENS.inlineBackground,
          border: `1px solid ${CODE_SURFACE_TOKENS.inlineBorder}`,
          borderRadius: 4,
          padding: "1px 5px",
        },
        "pre code": {
          backgroundColor: "transparent",
          border: "none",
          padding: 0,
          fontSize: "inherit",
        },
      },
    },
    MuiAppBar: {
      defaultProps: {
        elevation: 0,
        color: "default",
      },
      styleOverrides: {
        root: ({ theme }) => ({
          backgroundColor: theme.palette.background.paper,
          borderBottom: `1px solid ${theme.palette.divider}`,
        }),
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
      styleOverrides: {
        root: {
          borderRadius: 8,
          paddingInline: 16,
        },
      },
    },
    MuiTextField: {
      defaultProps: {
        size: "small",
        variant: "outlined",
      },
    },
    MuiCard: {
      defaultProps: {
        variant: "outlined",
      },
    },
    MuiPaper: {
      styleOverrides: {
        outlined: ({ theme }) => ({
          borderColor: theme.palette.divider,
        }),
      },
    },
    MuiTab: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          minHeight: 48,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: ({ theme }) => ({
          fontWeight: 600,
          backgroundColor: theme.palette.grey[100],
          color: theme.palette.text.primary,
        }),
      },
    },
    MuiDialogTitle: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          fontSize: "1.125rem",
        },
      },
    },
  },
});
