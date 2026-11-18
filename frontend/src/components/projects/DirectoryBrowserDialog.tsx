import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  InputAdornment,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import FolderSpecialIcon from "@mui/icons-material/FolderSpecial";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import HomeIcon from "@mui/icons-material/Home";
import ScienceIcon from "@mui/icons-material/Science";
import DesktopMacIcon from "@mui/icons-material/DesktopMac";
import DescriptionIcon from "@mui/icons-material/Description";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import SearchIcon from "@mui/icons-material/Search";
import CreateNewFolderIcon from "@mui/icons-material/CreateNewFolder";
import AppleIcon from "@mui/icons-material/Apple";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../../api/client";
import type { DirectoryListingResponse, DirectoryShortcut } from "../../types/api";

export interface DirectoryBrowserDialogProps {
  open: boolean;
  title?: string;
  initialPath?: string;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
}

interface BreadcrumbSegment {
  label: string;
  path: string;
}

export function buildBreadcrumbs(fullPath: string): BreadcrumbSegment[] {
  if (!fullPath) return [];
  const parts = fullPath.split("/").filter(Boolean);
  const segments: BreadcrumbSegment[] = [{ label: "/", path: "/" }];
  let accum = "";
  for (const part of parts) {
    accum += `/${part}`;
    segments.push({ label: part, path: accum });
  }
  return segments;
}

function renderShortcutIcon(iconKey: string): React.ReactNode {
  switch (iconKey) {
    case "science":
      return <ScienceIcon fontSize="small" color="primary" />;
    case "home":
      return <HomeIcon fontSize="small" />;
    case "desktop":
      return <DesktopMacIcon fontSize="small" />;
    case "documents":
      return <DescriptionIcon fontSize="small" />;
    case "downloads":
      return <DownloadIcon fontSize="small" />;
    default:
      return <FolderIcon fontSize="small" />;
  }
}

export const DirectoryBrowserDialog: React.FC<DirectoryBrowserDialogProps> = ({
  open,
  title = "Select Directory",
  initialPath,
  onClose,
  onSelect,
}) => {
  const [listing, setListing] = useState<DirectoryListingResponse | null>(null);
  const [selectedPath, setSelectedPath] = useState<string>("");
  const [filterText, setFilterText] = useState<string>("");
  const [newFolderOpen, setNewFolderOpen] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [pickingNative, setPickingNative] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadPath = async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDirectories(targetPath);
      setListing(res);
      setSelectedPath(res.current);
      setFilterText("");
      if (res.error) {
        setError(res.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list directories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      setNewFolderOpen(false);
      setNewFolderName("");
      void loadPath(initialPath || undefined);
    }
  }, [open, initialPath]);

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(listing?.current ?? ""),
    [listing?.current]
  );

  const shortcuts: DirectoryShortcut[] = useMemo(() => {
    if (listing?.shortcuts && listing.shortcuts.length > 0) {
      return listing.shortcuts;
    }
    const items: DirectoryShortcut[] = [];
    if (listing?.pipeline_parent) {
      items.push({ label: "Projects Root", path: listing.pipeline_parent, icon: "science" });
    }
    if (listing?.home) {
      items.push({ label: "Home", path: listing.home, icon: "home" });
    }
    return items;
  }, [listing]);

  const filteredDirectories = useMemo(() => {
    const dirs = listing?.directories ?? [];
    if (!filterText.trim()) return dirs;
    const q = filterText.toLowerCase();
    return dirs.filter((d) => d.name.toLowerCase().includes(q));
  }, [listing?.directories, filterText]);

  const handleGoManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPath.trim()) {
      void loadPath(selectedPath.trim());
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!listing?.current || !newFolderName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.createDirectory(listing.current, newFolderName.trim());
      setListing(res);
      setSelectedPath(res.created ?? res.current);
      setNewFolderName("");
      setNewFolderOpen(false);
      if (res.created) {
        await loadPath(res.created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create folder");
    } finally {
      setLoading(false);
    }
  };

  const handlePickNativeFinder = async () => {
    setPickingNative(true);
    setError(null);
    try {
      const res = await api.pickNativeDirectory(title, selectedPath || listing?.current);
      if (!res.cancelled && res.path) {
        onSelect(res.path);
        onClose();
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to open native macOS Finder dialog"
      );
    } finally {
      setPickingNative(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        component="div"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
          py: 1.5,
        }}
      >
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Tooltip title="Open native macOS Finder folder chooser window">
            <Button
              size="small"
              variant="outlined"
              startIcon={
                pickingNative ? (
                  <CircularProgress size={14} color="inherit" />
                ) : (
                  <AppleIcon fontSize="small" />
                )
              }
              disabled={pickingNative}
              onClick={() => void handlePickNativeFinder()}
            >
              {pickingNative ? "Waiting for Finder..." : "Choose in macOS Finder…"}
            </Button>
          </Tooltip>
          <IconButton size="small" onClick={onClose} aria-label="Close directory browser">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0 }}>
        {/* Top Navigation & Breadcrumb Toolbar */}
        <Box
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: "background.default",
            borderBottom: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center" justifyContent="space-between">
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ overflowX: "auto", py: 0.25 }}
            >
              <Tooltip title="Up to Parent Directory">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Up to parent directory"
                    disabled={!listing?.parent || loading}
                    onClick={() => listing?.parent && void loadPath(listing.parent)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Breadcrumbs
                aria-label="Directory path breadcrumbs"
                separator={<ChevronRightIcon fontSize="small" />}
                maxItems={6}
                itemsBeforeCollapse={2}
                itemsAfterCollapse={3}
                sx={{ fontSize: "0.85rem" }}
              >
                {breadcrumbs.map((seg, idx) => {
                  const isLast = idx === breadcrumbs.length - 1;
                  return isLast ? (
                    <Typography
                      key={seg.path}
                      variant="body2"
                      sx={{ fontWeight: 700, color: "text.primary" }}
                    >
                      {seg.label}
                    </Typography>
                  ) : (
                    <Link
                      key={seg.path}
                      component="button"
                      type="button"
                      underline="hover"
                      color="inherit"
                      onClick={() => void loadPath(seg.path)}
                      sx={{ fontSize: "0.85rem" }}
                    >
                      {seg.label}
                    </Link>
                  );
                })}
              </Breadcrumbs>
            </Stack>

            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                placeholder="Filter folders..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
                sx={{ width: 185, bgcolor: "background.paper" }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: filterText ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="Clear folder filter"
                          onClick={() => setFilterText("")}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
              <Button
                size="small"
                variant="outlined"
                startIcon={<CreateNewFolderIcon fontSize="small" />}
                onClick={() => setNewFolderOpen((prev) => !prev)}
                sx={{ whiteSpace: "nowrap" }}
              >
                New Folder
              </Button>
              <Tooltip title="Refresh">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Refresh directory listing"
                    disabled={loading}
                    onClick={() => void loadPath(listing?.current)}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          </Stack>

          <Collapse in={newFolderOpen}>
            <Paper
              component="form"
              onSubmit={handleCreateFolder}
              variant="outlined"
              sx={{ mt: 1.25, p: 1, display: "flex", gap: 1, alignItems: "center" }}
            >
              <TextField
                label="New Folder Name"
                placeholder="e.g. Analysis_Run"
                fullWidth
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
              />
              <Button
                type="submit"
                size="small"
                variant="contained"
                disabled={loading || !newFolderName.trim()}
              >
                Create &amp; Open
              </Button>
            </Paper>
          </Collapse>
        </Box>

        {error && (
          <Alert severity="warning" sx={{ m: 1.5 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Dual-Pane Finder Layout: Places Sidebar + Directory List */}
        <Box sx={{ display: "flex", height: 360 }}>
          {/* Left Places Sidebar */}
          <Box
            sx={{
              width: 195,
              flexShrink: 0,
              borderRight: "1px solid",
              borderColor: "divider",
              bgcolor: "background.default",
              overflowY: "auto",
              py: 1,
            }}
          >
            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ px: 2, display: "block", lineHeight: 1.8 }}
            >
              Locations
            </Typography>
            <List dense disablePadding>
              {shortcuts.map((sc) => (
                <ListItemButton
                  key={sc.path}
                  selected={listing?.current === sc.path}
                  onClick={() => void loadPath(sc.path)}
                  sx={{ py: 0.75 }}
                >
                  <ListItemIcon sx={{ minWidth: 32 }}>{renderShortcutIcon(sc.icon)}</ListItemIcon>
                  <ListItemText
                    primary={sc.label}
                    primaryTypographyProps={{ variant: "body2", noWrap: true }}
                  />
                </ListItemButton>
              ))}
            </List>
          </Box>

          {/* Right Directory Listing */}
          <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
            {loading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
                <CircularProgress size={28} />
              </Stack>
            ) : filteredDirectories.length === 0 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  {filterText.trim()
                    ? `No folders matching "${filterText}"`
                    : "No subdirectories in this folder."}
                </Typography>
              </Stack>
            ) : (
              <List dense disablePadding>
                {filteredDirectories.map((dir) => {
                  const isSelected = selectedPath === dir.path;
                  return (
                    <React.Fragment key={dir.path}>
                      <ListItem disablePadding>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => setSelectedPath(dir.path)}
                          onDoubleClick={() => void loadPath(dir.path)}
                          sx={{ display: "flex", alignItems: "center", gap: 1 }}
                        >
                          <ListItemIcon sx={{ minWidth: 30 }}>
                            {dir.has_config ? (
                              <FolderSpecialIcon color="primary" fontSize="small" />
                            ) : (
                              <FolderIcon color="action" fontSize="small" />
                            )}
                          </ListItemIcon>
                          <ListItemText
                            primary={dir.name}
                            sx={{ minWidth: 0, flexGrow: 1 }}
                            primaryTypographyProps={{
                              fontWeight: dir.has_config || isSelected ? 600 : 400,
                              noWrap: true,
                            }}
                          />
                          <Stack
                            direction="row"
                            spacing={0.75}
                            alignItems="center"
                            sx={{ flexShrink: 0 }}
                          >
                            {dir.has_config && (
                              <Chip
                                label="experiment.config"
                                size="small"
                                color="primary"
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.7rem" }}
                              />
                            )}
                            {dir.has_run_sh && (
                              <Chip
                                label="run.sh"
                                size="small"
                                color="success"
                                variant="outlined"
                                sx={{ height: 20, fontSize: "0.7rem" }}
                              />
                            )}
                            <Tooltip title="Open folder">
                              <IconButton
                                size="small"
                                edge="end"
                                aria-label={`Open folder ${dir.name}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void loadPath(dir.path);
                                }}
                              >
                                <ChevronRightIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </ListItemButton>
                      </ListItem>
                      <Divider component="li" />
                    </React.Fragment>
                  );
                })}
              </List>
            )}
          </Box>
        </Box>

        {/* Bottom Selected Path Bar */}
        <Box
          component="form"
          onSubmit={handleGoManual}
          sx={{
            px: 2,
            py: 1.25,
            bgcolor: "background.default",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              label="Selected Directory Path (Single-click folder to select, Double-click to open)"
              fullWidth
              value={selectedPath}
              onChange={(e) => setSelectedPath(e.target.value)}
              sx={{ bgcolor: "background.paper" }}
            />
            <Button type="submit" variant="outlined" size="small" sx={{ whiteSpace: "nowrap" }}>
              Navigate Here
            </Button>
          </Stack>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!selectedPath.trim()}
          onClick={() => {
            onSelect(selectedPath.trim());
            onClose();
          }}
        >
          Use Selected Directory
        </Button>
      </DialogActions>
    </Dialog>
  );
};
