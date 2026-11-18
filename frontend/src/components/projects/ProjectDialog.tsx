import React, { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import BookmarkAddIcon from "@mui/icons-material/BookmarkAdd";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../../api/client";
import type {
  ProjectsStateResponse,
  TemplateMetadata,
} from "../../types/api";
import { DirectoryBrowserDialog } from "./DirectoryBrowserDialog";

export interface ProjectDialogProps {
  open: boolean;
  initialTab?: number;
  projectsState: ProjectsStateResponse | null;
  onClose: () => void;
  onProjectChanged: (nextState: ProjectsStateResponse) => void;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

export const ProjectDialog: React.FC<ProjectDialogProps> = ({
  open,
  initialTab = 0,
  projectsState,
  onClose,
  onProjectChanged,
  onNotify,
}) => {
  const [tab, setTab] = useState<number>(initialTab);
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Tab 0: Open Existing Project
  const [openPath, setOpenPath] = useState<string>("");
  const [initializeIfMissing, setInitializeIfMissing] = useState<boolean>(true);

  // Tab 1: Create New Project from Template
  const [newTargetDir, setNewTargetDir] = useState<string>("");
  const [newExpName, setNewExpName] = useState<string>("cut_run_01");
  const [newTemplateId, setNewTemplateId] = useState<string>("default_ce11");
  const [newEmail, setNewEmail] = useState<string>("");
  const [newInputDir, setNewInputDir] = useState<string>("");
  const [overwriteExisting, setOverwriteExisting] = useState<boolean>(false);

  // Tab 2: Save Current Project as Template
  const [tplName, setTplName] = useState<string>("");
  const [tplDescription, setTplDescription] = useState<string>("");
  const [tplGenome, setTplGenome] = useState<string>("ce11");
  const [includeSamplesheetRows, setIncludeSamplesheetRows] = useState<boolean>(false);

  // Directory browser state
  const [browserTarget, setBrowserTarget] = useState<"open" | "newTarget" | "newInput" | null>(
    null
  );

  const loadTemplates = async () => {
    try {
      const list = await api.listTemplates();
      setTemplates(list);
      if (list.length > 0 && !list.some((t) => t.id === newTemplateId)) {
        setNewTemplateId(list[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    }
  };

  useEffect(() => {
    if (open) {
      setTab(initialTab);
      setError(null);
      if (projectsState?.current?.path) {
        setOpenPath(projectsState.current.path);
      }
      void loadTemplates();
    }
  }, [open, initialTab, projectsState?.current?.path]);

  const handleOpenProject = async (targetPath: string, initialize = false) => {
    setBusy(true);
    setError(null);
    try {
      const next = await api.openProject({
        path: targetPath,
        initialize,
        template_id: newTemplateId,
      });
      onProjectChanged(next);
      onNotify(`Opened project: ${next.current.label}`, "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open project");
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveHistory = async (pathToRemove: string) => {
    try {
      const next = await api.removeProjectHistory(pathToRemove);
      onProjectChanged(next);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to remove from history", "error");
    }
  };

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const next = await api.createProject({
        target_dir: newTargetDir,
        experiment_name: newExpName,
        template_id: newTemplateId,
        email: newEmail,
        input_dir: newInputDir,
        overwrite: overwriteExisting,
      });
      onProjectChanged(next);
      onNotify(`Created and opened project ${next.current.label}`, "success");
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setBusy(false);
    }
  };

  const handleSaveTemplateFromProject = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const saved = await api.saveTemplateFromProject({
        name: tplName,
        description: tplDescription,
        genome: tplGenome,
        include_samplesheet_rows: includeSamplesheetRows,
      });
      setTplName("");
      setTplDescription("");
      await loadTemplates();
      onNotify(`Saved template "${saved.name}" to ~/.config/cutandrun_web/templates`, "success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setBusy(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    try {
      await api.deleteTemplate(templateId);
      await loadTemplates();
      onNotify(`Deleted template ${templateId}`, "info");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Cannot delete template", "error");
    }
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <Box>
            <Typography variant="h6">Projects &amp; Templates</Typography>
            <Typography variant="caption" color="text.secondary">
              Metadata &amp; templates stored in{" "}
              <code>{projectsState?.user_config_dir ?? "$HOME/.config/cutandrun_web"}</code>
            </Typography>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <Box sx={{ borderBottom: 1, borderColor: "divider", px: 3 }}>
          <Tabs value={tab} onChange={(_, v: number) => setTab(v)}>
            <Tab icon={<FolderOpenIcon fontSize="small" />} iconPosition="start" label="Open & History" />
            <Tab
              icon={<AddCircleOutlineIcon fontSize="small" />}
              iconPosition="start"
              label="New Project from Template"
            />
            <Tab
              icon={<BookmarkAddIcon fontSize="small" />}
              iconPosition="start"
              label="Manage Templates"
            />
          </Tabs>
        </Box>

        <DialogContent dividers sx={{ minHeight: 420 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {tab === 0 && (
            <Stack spacing={3}>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Typography variant="subtitle2" gutterBottom>
                  Open Project Directory
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Select a project folder containing <code>config/experiment.config</code>,{" "}
                  <code>config/samplesheet.csv</code>, and <code>run.sh</code>.
                </Typography>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField
                    label="Project Directory Path"
                    size="small"
                    fullWidth
                    value={openPath}
                    onChange={(e) => setOpenPath(e.target.value)}
                    placeholder="/path/to/Experiment_Cut_Run/Analysis_Run"
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setBrowserTarget("open")}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Browse...
                  </Button>
                  <Button
                    variant="contained"
                    disabled={busy || !openPath.trim()}
                    onClick={() => void handleOpenProject(openPath.trim(), initializeIfMissing)}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Open Project
                  </Button>
                </Stack>
                <FormControlLabel
                  sx={{ mt: 1 }}
                  control={
                    <Checkbox
                      size="small"
                      checked={initializeIfMissing}
                      onChange={(e) => setInitializeIfMissing(e.target.checked)}
                    />
                  }
                  label={
                    <Typography variant="caption" color="text.secondary">
                      Initialize missing starter files from default template if directory is empty
                    </Typography>
                  }
                />
              </Paper>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Recent Projects History
                </Typography>
                {!projectsState?.recent || projectsState.recent.length === 0 ? (
                  <Alert severity="info">No recent projects recorded yet.</Alert>
                ) : (
                  <Paper variant="outlined">
                    <List disablePadding>
                      {projectsState.recent.map((proj, idx) => {
                        const isCurrent = proj.path === projectsState.current.path;
                        return (
                          <React.Fragment key={proj.path}>
                            {idx > 0 && <Divider component="li" />}
                            <ListItem
                              disablePadding
                              secondaryAction={
                                !isCurrent && (
                                  <Tooltip title="Remove from history">
                                    <IconButton
                                      edge="end"
                                      size="small"
                                      onClick={() => void handleRemoveHistory(proj.path)}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )
                              }
                            >
                              <ListItemButton
                                selected={isCurrent}
                                onClick={() => void handleOpenProject(proj.path, false)}
                              >
                                <ListItemText
                                  primary={
                                    <Stack direction="row" spacing={1} alignItems="center">
                                      <Typography variant="subtitle2">{proj.label}</Typography>
                                      {proj.experiment && (
                                        <Chip
                                          label={proj.experiment}
                                          size="small"
                                          color="primary"
                                          variant="outlined"
                                        />
                                      )}
                                      {isCurrent && (
                                        <Chip
                                          icon={<CheckCircleIcon />}
                                          label="Active"
                                          size="small"
                                          color="success"
                                        />
                                      )}
                                    </Stack>
                                  }
                                  secondary={proj.path}
                                />
                              </ListItemButton>
                            </ListItem>
                          </React.Fragment>
                        );
                      })}
                    </List>
                  </Paper>
                )}
              </Box>
            </Stack>
          )}

          {tab === 1 && (
            <Box component="form" onSubmit={handleCreateProject}>
              <Stack spacing={2.5}>
                <Typography variant="body2" color="text.secondary">
                  Create a new project directory populated with <code>config/experiment.config</code>,{" "}
                  <code>config/samplesheet.csv</code>, <code>run.sh</code>, and <code>results/</code>{" "}
                  based on a template stored in <code>~/.config/cutandrun_web/templates</code>.
                </Typography>

                <TextField
                  select
                  label="Project Template"
                  size="small"
                  fullWidth
                  value={newTemplateId}
                  onChange={(e) => setNewTemplateId(e.target.value)}
                >
                  {templates.map((t) => (
                    <MenuItem key={t.id} value={t.id}>
                      {t.name} ({t.genome}) {t.built_in ? "[Built-in]" : ""}
                    </MenuItem>
                  ))}
                </TextField>

                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Target Project Directory (e.g. .../Experiment_X/Analysis_Run)"
                    size="small"
                    required
                    fullWidth
                    value={newTargetDir}
                    onChange={(e) => setNewTargetDir(e.target.value)}
                    placeholder="/Users/dan/Code/NextFlow/Arjamand/Experiment_New/Analysis_Run"
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setBrowserTarget("newTarget")}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Browse...
                  </Button>
                </Stack>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Experiment Identifier (params.experiment)"
                      size="small"
                      required
                      fullWidth
                      value={newExpName}
                      onChange={(e) => setNewExpName(e.target.value)}
                      helperText="Letters, digits, '.', '_', or '-'"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Notification Email (params.email)"
                      size="small"
                      fullWidth
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="researcher@umassmed.edu"
                    />
                  </Grid>
                </Grid>

                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Upstream Input Directory (params.input_dir, optional)"
                    size="small"
                    fullWidth
                    value={newInputDir}
                    onChange={(e) => setNewInputDir(e.target.value)}
                    placeholder="/path/to/upstream_cutandrun_outputs"
                  />
                  <Button
                    variant="outlined"
                    onClick={() => setBrowserTarget("newInput")}
                    sx={{ whiteSpace: "nowrap" }}
                  >
                    Browse...
                  </Button>
                </Stack>

                <FormControlLabel
                  control={
                    <Checkbox
                      size="small"
                      checked={overwriteExisting}
                      onChange={(e) => setOverwriteExisting(e.target.checked)}
                    />
                  }
                  label="Overwrite existing config/run.sh if target directory already has project files"
                />

                <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={busy || !newTargetDir.trim() || !newExpName.trim()}
                  >
                    Create &amp; Open Project
                  </Button>
                </Box>
              </Stack>
            </Box>
          )}

          {tab === 2 && (
            <Stack spacing={3}>
              <Paper
                component="form"
                onSubmit={handleSaveTemplateFromProject}
                variant="outlined"
                sx={{ p: 2 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Save Current Project as Template
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Snapshots the active project&apos;s <code>experiment.config</code> and{" "}
                  <code>run.sh</code> into <code>~/.config/cutandrun_web/templates/</code> for future
                  projects.
                </Typography>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 8 }}>
                    <TextField
                      label="Template Name"
                      size="small"
                      required
                      fullWidth
                      value={tplName}
                      onChange={(e) => setTplName(e.target.value)}
                      placeholder="e.g. C. elegans H3K4me3 + H3K27me3 Standard"
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField
                      label="Genome"
                      size="small"
                      fullWidth
                      value={tplGenome}
                      onChange={(e) => setTplGenome(e.target.value)}
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Description"
                      size="small"
                      fullWidth
                      value={tplDescription}
                      onChange={(e) => setTplDescription(e.target.value)}
                    />
                  </Grid>
                </Grid>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  sx={{ mt: 1.5 }}
                >
                  <FormControlLabel
                    control={
                      <Checkbox
                        size="small"
                        checked={includeSamplesheetRows}
                        onChange={(e) => setIncludeSamplesheetRows(e.target.checked)}
                      />
                    }
                    label={
                      <Typography variant="caption">
                        Include current <code>samplesheet.csv</code> rows (unchecked = header only)
                      </Typography>
                    }
                  />
                  <Button
                    type="submit"
                    variant="contained"
                    size="small"
                    disabled={busy || !tplName.trim()}
                  >
                    Save Template
                  </Button>
                </Stack>
              </Paper>

              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Available Templates ({templates.length})
                </Typography>
                <Paper variant="outlined">
                  <List disablePadding>
                    {templates.map((tpl, idx) => (
                      <React.Fragment key={tpl.id}>
                        {idx > 0 && <Divider component="li" />}
                        <ListItem
                          secondaryAction={
                            !tpl.built_in && (
                              <Tooltip title="Delete template">
                                <IconButton
                                  edge="end"
                                  size="small"
                                  color="error"
                                  onClick={() => void handleDeleteTemplate(tpl.id)}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )
                          }
                        >
                          <ListItemText
                            primary={
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2">{tpl.name}</Typography>
                                <Chip label={tpl.genome} size="small" variant="outlined" />
                                <Chip
                                  label={tpl.built_in ? "Built-in" : tpl.id}
                                  size="small"
                                  color={tpl.built_in ? "primary" : "default"}
                                />
                              </Stack>
                            }
                            secondary={tpl.description || `ID: ${tpl.id}`}
                          />
                        </ListItem>
                      </React.Fragment>
                    ))}
                  </List>
                </Paper>
              </Box>
            </Stack>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={onClose} color="inherit">
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <DirectoryBrowserDialog
        open={browserTarget !== null}
        title={
          browserTarget === "newInput"
            ? "Select Upstream Input Directory"
            : "Select Project Directory"
        }
        initialPath={
          browserTarget === "open"
            ? openPath
            : browserTarget === "newTarget"
              ? newTargetDir
              : newInputDir
        }
        onClose={() => setBrowserTarget(null)}
        onSelect={(selected) => {
          if (browserTarget === "open") setOpenPath(selected);
          if (browserTarget === "newTarget") setNewTargetDir(selected);
          if (browserTarget === "newInput") setNewInputDir(selected);
        }}
      />
    </>
  );
};
