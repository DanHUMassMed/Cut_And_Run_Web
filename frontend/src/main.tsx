import React from "react";
import ReactDOM from "react-dom/client";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { appTheme } from "./theme/theme";
import { App } from "./App";
import { AdminPage } from "./features/admin/AdminPage";

export function isAdminRoute(pathname: string): boolean {
  const normalized = pathname.replace(/\/+$/, "");
  return normalized === "/admin" || normalized.startsWith("/admin/");
}

const rootElement = typeof document !== "undefined" ? document.getElementById("root") : null;
if (rootElement) {
  const isAdmin = isAdminRoute(window.location.pathname);
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <ThemeProvider theme={appTheme}>
        <CssBaseline />
        {isAdmin ? <AdminPage /> : <App />}
      </ThemeProvider>
    </React.StrictMode>
  );
}
