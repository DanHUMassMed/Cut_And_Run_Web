import React from "react";
import {
  Alert,
  AppBar,
  Box,
  Container,
  Snackbar,
  Stack,
  Toolbar,
  Typography,
} from "@mui/material";
import type { ToastState } from "../../hooks/useNotification";

export interface AppShellProps {
  icon: React.ReactNode;
  iconBgColor?: string;
  title: string;
  titleBadge?: React.ReactNode;
  subtitle: React.ReactNode;
  headerCenter?: React.ReactNode;
  headerActions?: React.ReactNode;
  navigationTabs?: React.ReactNode;
  toast: ToastState;
  onCloseToast: () => void;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  icon,
  iconBgColor = "primary.main",
  title,
  titleBadge,
  subtitle,
  headerCenter,
  headerActions,
  navigationTabs,
  toast,
  onCloseToast,
  children,
}) => {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.default",
      }}
    >
      <AppBar position="sticky">
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 1 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: iconBgColor,
                color: "common.white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              {icon}
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="subtitle1" sx={{ lineHeight: 1.2, fontWeight: 700 }}>
                  {title}
                </Typography>
                {titleBadge}
              </Stack>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {subtitle}
              </Typography>
            </Box>
          </Stack>

          {headerCenter}

          <Box sx={{ flexGrow: 1 }} />

          {headerActions && (
            <Stack direction="row" spacing={1.5} alignItems="center">
              {headerActions}
            </Stack>
          )}
        </Toolbar>

        {navigationTabs && <Container maxWidth="xl">{navigationTabs}</Container>}
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
        {children}
      </Container>

      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={onCloseToast}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={onCloseToast}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
