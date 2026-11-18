import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FolderIcon from "@mui/icons-material/Folder";
import ArrowUpwardIcon from "@mui/icons-material/ArrowUpward";
import HomeIcon from "@mui/icons-material/Home";
import ScienceIcon from "@mui/icons-material/Science";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../../api/client";
import type { DirectoryListingResponse } from "../../types/api";

export interface DirectoryBrowserDialogProps {
  open: boolean;
  title?: string;
  initialPath?: string;
  onClose: () => void;
  onSelect: (selectedPath: string) => void;
}

export const DirectoryBrowserDialog: React.FC<DirectoryBrowserDialogProps> = ({
  open,
  title = "Select Directory",
  initialPath,
  onClose,
  onSelect,
}) => {
  const [listing, setListing] = useState<DirectoryListingResponse | null>(null);
  const [manualPath, setManualPath] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadPath = async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.listDirectories(targetPath);
      setListing(res);
      setManualPath(res.current);
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
      void loadPath(initialPath || undefined);
    }
  }, [open, initialPath]);

  const handleGoManual = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualPath.trim()) {
      void loadPath(manualPath.trim());
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        <Stack spacing={2}>
          <Box component="form" onSubmit={handleGoManual}>
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                label="Current Path"
                size="small"
                fullWidth
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
              />
              <Button type="submit" variant="outlined" size="small">
                Go
              </Button>
              <Tooltip title="Parent Directory">
                <span>
                  <IconButton
                    size="small"
                    disabled={!listing?.parent || loading}
                    onClick={() => listing?.parent && void loadPath(listing.parent)}
                  >
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Home Directory">
                <span>
                  <IconButton
                    size="small"
                    disabled={!listing?.home || loading}
                    onClick={() => listing?.home && void loadPath(listing.home)}
                  >
                    <HomeIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Projects Root">
                <span>
                  <IconButton
                    size="small"
                    disabled={!listing?.pipeline_parent || loading}
                    onClick={() =>
                      listing?.pipeline_parent && void loadPath(listing.pipeline_parent)
                    }
                  >
                    <ScienceIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Refresh">
                <IconButton
                  size="small"
                  disabled={loading}
                  onClick={() => void loadPath(listing?.current)}
                >
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {error && <Alert severity="warning">{error}</Alert>}

          <Box
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1.5,
              height: 340,
              overflowY: "auto",
            }}
          >
            {loading ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
                <CircularProgress size={28} />
              </Stack>
            ) : listing && listing.directories.length === 0 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ height: "100%", p: 2 }}>
                <Typography variant="body2" color="text.secondary">
                  No subdirectories in this folder.
                </Typography>
              </Stack>
            ) : (
              <List dense disablePadding>
                {listing?.directories.map((dir) => (
                  <React.Fragment key={dir.path}>
                    <ListItemButton onClick={() => void loadPath(dir.path)}>
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        <FolderIcon color={dir.has_config ? "primary" : "action"} />
                      </ListItemIcon>
                      <ListItemText
                        primary={dir.name}
                        secondary={dir.path}
                        primaryTypographyProps={{ fontWeight: dir.has_config ? 600 : 400 }}
                      />
                      <Stack direction="row" spacing={0.5}>
                        {dir.has_config && (
                          <Chip label="experiment.config" size="small" color="primary" variant="outlined" />
                        )}
                        {dir.has_run_sh && (
                          <Chip label="run.sh" size="small" color="success" variant="outlined" />
                        )}
                      </Stack>
                    </ListItemButton>
                    <Divider component="li" />
                  </React.Fragment>
                ))}
              </List>
            )}
          </Box>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          variant="contained"
          disabled={!manualPath.trim()}
          onClick={() => {
            onSelect(manualPath.trim());
            onClose();
          }}
        >
          Use This Directory
        </Button>
      </DialogActions>
    </Dialog>
  );
};
