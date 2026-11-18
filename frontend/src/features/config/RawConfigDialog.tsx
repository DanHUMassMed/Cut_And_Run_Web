import React, { useState } from "react";
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import { api } from "../../api/client";
import { CodeViewer } from "../../components/common/CodeSurface";

export interface RawConfigDialogProps {
  open: boolean;
  rawText: string;
  onClose: () => void;
  onNotify?: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

export const RawConfigDialog: React.FC<RawConfigDialogProps> = ({
  open,
  rawText,
  onClose,
  onNotify,
}) => {
  const [revealing, setRevealing] = useState<boolean>(false);

  const handleRevealInFinder = async () => {
    setRevealing(true);
    try {
      const res = await api.revealConfigInFinder();
      onNotify?.(`Revealed ${res.path} in Finder`, "info");
    } catch (err) {
      onNotify?.(
        err instanceof Error ? err.message : "Could not reveal experiment.config in Finder",
        "error"
      );
    } finally {
      setRevealing(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle
        component="div"
        sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}
      >
        <Typography variant="h6" component="h2">
          View Experiment Config (<code>config/experiment.config</code>)
        </Typography>
        <Stack direction="row" spacing={1} alignItems="center">
          <Button
            size="small"
            variant="outlined"
            startIcon={
              revealing ? (
                <CircularProgress size={14} color="inherit" />
              ) : (
                <FolderOpenIcon fontSize="small" />
              )
            }
            disabled={revealing}
            onClick={() => void handleRevealInFinder()}
          >
            Reveal in Finder
          </Button>
          <IconButton onClick={onClose} size="small" aria-label="Close config viewer">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      </DialogTitle>
      <DialogContent dividers>
        <CodeViewer maxHeight={520}>{rawText}</CodeViewer>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button
          variant="outlined"
          startIcon={
            revealing ? (
              <CircularProgress size={16} color="inherit" />
            ) : (
              <FolderOpenIcon fontSize="small" />
            )
          }
          disabled={revealing}
          onClick={() => void handleRevealInFinder()}
        >
          Reveal in Finder
        </Button>
        <Button variant="contained" onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
};
