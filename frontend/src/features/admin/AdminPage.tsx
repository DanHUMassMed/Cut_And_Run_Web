import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import AddIcon from "@mui/icons-material/Add";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import SaveIcon from "@mui/icons-material/Save";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CloseIcon from "@mui/icons-material/Close";
import { api } from "../../api/client";
import type {
  ProjectsStateResponse,
  TemplateDetail,
  TemplateMetadata,
} from "../../types/api";
import { useNotification } from "../../hooks/useNotification";
import { AppShell } from "../../components/common/AppShell";
import { CodeEditor } from "../../components/common/CodeSurface";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";

type AdminSection = "templates";
type EditorFileTab = "config" | "samplesheet" | "run_sh";

export const AdminPage: React.FC = () => {
  const [section, setSection] = useState<AdminSection>("templates");
  const [projectsState, setProjectsState] = useState<ProjectsStateResponse | null>(null);
  const [templates, setTemplates] = useState<TemplateMetadata[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busy, setBusy] = useState<boolean>(false);

  // Snapshot active project into a new template
  const [tplName, setTplName] = useState<string>("");
  const [tplGenome, setTplGenome] = useState<string>("ce11");
  const [tplDescription, setTplDescription] = useState<string>("");
  const [includeSamplesheetRows, setIncludeSamplesheetRows] = useState<boolean>(false);

  // Direct template editor modal state
  const [editorOpen, setEditorOpen] = useState<boolean>(false);
  const [editorFileTab, setEditorFileTab] = useState<EditorFileTab>("config");
  const [editingTemplate, setEditingTemplate] = useState<TemplateDetail | null>(null);
  const [isNewTemplate, setIsNewTemplate] = useState<boolean>(false);

  // Delete confirmation modal state
  const [templateToDelete, setTemplateToDelete] = useState<TemplateMetadata | null>(null);

  const { toast, notify, closeToast } = useNotification();

  const loadAdminData = useCallback(async () => {
    setLoading(true);
    try {
      const [projRes, tplList] = await Promise.all([
        api.getProjectsState(),
        api.listTemplates(),
      ]);
      setProjectsState(projRes);
      setTemplates(tplList);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to load admin data",
        "error"
      );
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

  const handleSaveFromActiveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) return;
    setBusy(true);
    try {
      const saved = await api.saveTemplateFromProject({
        name: tplName.trim(),
        description: tplDescription.trim(),
        genome: tplGenome.trim() || "ce11",
        include_samplesheet_rows: includeSamplesheetRows,
      });
      setTplName("");
      setTplDescription("");
      const updated = await api.listTemplates();
      setTemplates(updated);
      notify(
        `Saved template "${saved.name}" (${saved.id}) to ~/.config/cutandrun_web/templates`,
        "success"
      );
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to save template from active project",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleOpenTemplateEditor = async (templateId?: string) => {
    setBusy(true);
    try {
      if (templateId) {
        const detail = await api.getTemplate(templateId);
        setEditingTemplate(detail);
        setIsNewTemplate(false);
      } else {
        const seed = await api.getTemplate("default_ce11");
        setEditingTemplate({
          id: "",
          name: "",
          description: "",
          genome: seed.genome || "ce11",
          created_at: "",
          updated_at: "",
          built_in: false,
          experiment_config: seed.experiment_config,
          samplesheet_csv: seed.samplesheet_csv,
          run_sh: seed.run_sh,
        });
        setIsNewTemplate(true);
      }
      setEditorFileTab("config");
      setEditorOpen(true);
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to load template details",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleSaveEditedTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTemplate || !editingTemplate.name.trim()) return;
    setBusy(true);
    try {
      const saved = await api.saveTemplate({
        id: isNewTemplate ? undefined : editingTemplate.id,
        name: editingTemplate.name.trim(),
        description: editingTemplate.description.trim(),
        genome: editingTemplate.genome.trim() || "ce11",
        experiment_config: editingTemplate.experiment_config,
        samplesheet_csv: editingTemplate.samplesheet_csv,
        run_sh: editingTemplate.run_sh,
      });
      const updated = await api.listTemplates();
      setTemplates(updated);
      setEditorOpen(false);
      notify(`Saved template "${saved.name}" (${saved.id})`, "success");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to save template",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDeleteTemplate = async () => {
    if (!templateToDelete || templateToDelete.built_in) return;
    setBusy(true);
    try {
      await api.deleteTemplate(templateToDelete.id);
      const deletedName = templateToDelete.name;
      setTemplateToDelete(null);
      const updated = await api.listTemplates();
      setTemplates(updated);
      notify(`Deleted template "${deletedName}"`, "info");
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to delete template",
        "error"
      );
    } finally {
      setBusy(false);
    }
  };

  const navigationTabs = (
    <Tabs
      value={section}
      onChange={(_, v: AdminSection) => setSection(v)}
      textColor="primary"
      indicatorColor="primary"
      aria-label="Admin sections"
    >
      <Tab
        value="templates"
        icon={<BookmarkBorderIcon fontSize="small" />}
        iconPosition="start"
        label="Project Templates"
      />
    </Tabs>
  );

  return (
    <AppShell
      icon={<AdminPanelSettingsIcon />}
      iconBgColor="secondary.main"
      title="CUT&RUN Admin Console"
      titleBadge={<Chip label="/admin" size="small" color="secondary" variant="outlined" />}
      subtitle={
        <>
          Template &amp; System Administration ({" "}
          <code>{projectsState?.user_config_dir ?? "~/.config/cutandrun_web"}</code> )
        </>
      }
      headerActions={
        <Button
          component="a"
          href="/"
          variant="outlined"
          size="small"
          startIcon={<ArrowBackIcon fontSize="small" />}
        >
          Back to Control Center
        </Button>
      }
      navigationTabs={navigationTabs}
      toast={toast}
      onCloseToast={closeToast}
    >
      {loading ? (
        <Stack spacing={3}>
          <Skeleton variant="rounded" height={220} />
          <Skeleton variant="rounded" height={280} />
        </Stack>
      ) : (
        <>
          {section === "templates" && (
            <Stack spacing={3}>
              {/* 1. Save Active Project as Template */}
              <Card>
                <CardHeader
                  title="Save Active Project as Template"
                  subheader={
                    projectsState?.current?.path
                      ? `Snapshots ${projectsState.current.path} (experiment.config, run.sh, and samplesheet.csv) into ~/.config/cutandrun_web/templates/`
                      : "Snapshots the active project into ~/.config/cutandrun_web/templates/"
                  }
                />
                <Divider />
                <CardContent>
                  {!projectsState?.current?.has_config ? (
                    <Alert severity="warning">
                      Active workspace (<code>{projectsState?.current?.path}</code>) does not have a{" "}
                      <code>config/experiment.config</code> file yet. Use &ldquo;New Template&rdquo; below
                      to create a template directly, or open a configured project in the main app first.
                    </Alert>
                  ) : (
                    <Box component="form" onSubmit={handleSaveFromActiveProject}>
                      <Grid container spacing={2}>
                        <Grid size={{ xs: 12, sm: 6 }}>
                          <TextField
                            label="Template Name"
                            required
                            fullWidth
                            value={tplName}
                            onChange={(e) => setTplName(e.target.value)}
                            placeholder="e.g. C. elegans H3K4me3 + H3K27me3 Standard"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <TextField
                            label="Genome"
                            fullWidth
                            value={tplGenome}
                            onChange={(e) => setTplGenome(e.target.value)}
                            placeholder="ce11"
                          />
                        </Grid>
                        <Grid size={{ xs: 12, sm: 3 }}>
                          <TextField
                            label="Source Experiment"
                            fullWidth
                            disabled
                            value={projectsState.current.experiment || projectsState.current.label}
                          />
                        </Grid>
                        <Grid size={{ xs: 12 }}>
                          <TextField
                            label="Description"
                            fullWidth
                            value={tplDescription}
                            onChange={(e) => setTplDescription(e.target.value)}
                            placeholder="Summary of peak callers, parameters, or organism settings"
                          />
                        </Grid>
                      </Grid>
                      <Stack
                        direction="row"
                        justifyContent="space-between"
                        alignItems="center"
                        sx={{ mt: 2, flexWrap: "wrap", gap: 1 }}
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
                            <Typography variant="body2">
                              Include current <code>samplesheet.csv</code> rows (unchecked = header only)
                            </Typography>
                          }
                        />
                        <Button
                          type="submit"
                          variant="contained"
                          startIcon={
                            busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
                          }
                          disabled={busy || !tplName.trim()}
                        >
                          Save Active Project as Template
                        </Button>
                      </Stack>
                    </Box>
                  )}
                </CardContent>
              </Card>

              {/* 2. Manage Existing Templates */}
              <Card>
                <CardHeader
                  title={`Available Project Templates (${templates.length})`}
                  subheader="Templates selectable by users when creating a new project"
                  action={
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<AddIcon />}
                      disabled={busy}
                      onClick={() => void handleOpenTemplateEditor()}
                    >
                      New Template
                    </Button>
                  }
                />
                <Divider />
                <CardContent sx={{ p: 0 }}>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Template Name</TableCell>
                          <TableCell>Template ID</TableCell>
                          <TableCell>Genome</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell align="right" width={140}>
                            Actions
                          </TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {templates.map((tpl) => (
                          <TableRow key={tpl.id} hover>
                            <TableCell>
                              <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="subtitle2">{tpl.name}</Typography>
                                {tpl.built_in && (
                                  <Chip label="Built-in" size="small" color="primary" />
                                )}
                              </Stack>
                            </TableCell>
                            <TableCell>
                              <code>{tpl.id}</code>
                            </TableCell>
                            <TableCell>
                              <Chip label={tpl.genome} size="small" variant="outlined" />
                            </TableCell>
                            <TableCell>
                              <Typography variant="body2" color="text.secondary">
                                {tpl.description || "—"}
                              </Typography>
                            </TableCell>
                            <TableCell align="right">
                              <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                                <Tooltip title="Inspect / Edit Template Files">
                                  <IconButton
                                    size="small"
                                    color="primary"
                                    aria-label={`Edit template ${tpl.name}`}
                                    disabled={busy}
                                    onClick={() => void handleOpenTemplateEditor(tpl.id)}
                                  >
                                    <EditOutlinedIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                                {!tpl.built_in && (
                                  <Tooltip title="Delete Template">
                                    <IconButton
                                      size="small"
                                      color="error"
                                      aria-label={`Delete template ${tpl.name}`}
                                      disabled={busy}
                                      onClick={() => setTemplateToDelete(tpl)}
                                    >
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </Tooltip>
                                )}
                              </Stack>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </CardContent>
              </Card>
            </Stack>
          )}
        </>
      )}

      {/* Template Detail & File Editor Modal */}
      <Dialog
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <Box component="form" onSubmit={handleSaveEditedTemplate}>
          <DialogTitle
            component="div"
            sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}
          >
            <Box>
              <Typography variant="h6" component="h2">
                {isNewTemplate
                  ? "Create New Project Template"
                  : `Edit Template: ${editingTemplate?.name ?? ""}`}
              </Typography>
              {!isNewTemplate && editingTemplate?.id && (
                <Typography variant="caption" color="text.secondary">
                  Template ID: <code>{editingTemplate.id}</code>
                </Typography>
              )}
            </Box>
            <IconButton
              onClick={() => setEditorOpen(false)}
              size="small"
              aria-label="Close template editor"
            >
              <CloseIcon />
            </IconButton>
          </DialogTitle>

          <DialogContent dividers>
            {editingTemplate && (
              <Stack spacing={2.5}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <TextField
                      label="Template Name"
                      required
                      fullWidth
                      value={editingTemplate.name}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, name: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      label="Genome"
                      fullWidth
                      value={editingTemplate.genome}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, genome: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}>
                    <TextField
                      label="Template ID"
                      fullWidth
                      disabled={!isNewTemplate}
                      value={editingTemplate.id}
                      placeholder="Auto-generated from name"
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, id: e.target.value })
                      }
                    />
                  </Grid>
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      label="Description"
                      fullWidth
                      value={editingTemplate.description}
                      onChange={(e) =>
                        setEditingTemplate({ ...editingTemplate, description: e.target.value })
                      }
                    />
                  </Grid>
                </Grid>

                <Paper variant="outlined">
                  <Tabs
                    value={editorFileTab}
                    onChange={(_, v: EditorFileTab) => setEditorFileTab(v)}
                    aria-label="Template file tabs"
                    sx={{ borderBottom: 1, borderColor: "divider", px: 2 }}
                  >
                    <Tab value="config" label="experiment.config" />
                    <Tab value="samplesheet" label="samplesheet.csv" />
                    <Tab value="run_sh" label="run.sh" />
                  </Tabs>
                  <Box sx={{ p: 2 }}>
                    {editorFileTab === "config" && (
                      <CodeEditor
                        minRows={14}
                        maxRows={22}
                        value={editingTemplate.experiment_config}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            experiment_config: e.target.value,
                          })
                        }
                      />
                    )}
                    {editorFileTab === "samplesheet" && (
                      <CodeEditor
                        minRows={10}
                        maxRows={20}
                        value={editingTemplate.samplesheet_csv}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            samplesheet_csv: e.target.value,
                          })
                        }
                      />
                    )}
                    {editorFileTab === "run_sh" && (
                      <CodeEditor
                        minRows={12}
                        maxRows={20}
                        value={editingTemplate.run_sh}
                        onChange={(e) =>
                          setEditingTemplate({
                            ...editingTemplate,
                            run_sh: e.target.value,
                          })
                        }
                      />
                    )}
                  </Box>
                </Paper>
              </Stack>
            )}
          </DialogContent>

          <DialogActions sx={{ px: 3, py: 1.5 }}>
            <Button onClick={() => setEditorOpen(false)} color="inherit">
              Cancel
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={busy ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              disabled={busy || !editingTemplate?.name.trim()}
            >
              Save Template
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={templateToDelete !== null}
        title="Delete Project Template?"
        message={
          templateToDelete ? (
            <>
              Are you sure you want to permanently delete template{" "}
              <strong>{templateToDelete.name}</strong> (<code>{templateToDelete.id}</code>)?
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete Template"
        confirmColor="error"
        busy={busy}
        onConfirm={() => void handleConfirmDeleteTemplate()}
        onCancel={() => setTemplateToDelete(null)}
      />
    </AppShell>
  );
};
