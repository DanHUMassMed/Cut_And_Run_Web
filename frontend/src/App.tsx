import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  AppBar,
  Box,
  Button,
  Chip,
  Container,
  Paper,
  Snackbar,
  Stack,
  Tab,
  Tabs,
  Toolbar,
  Tooltip,
  Typography,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import BookmarkBorderIcon from "@mui/icons-material/BookmarkBorder";
import TuneIcon from "@mui/icons-material/Tune";
import TableChartIcon from "@mui/icons-material/TableChart";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import AssessmentIcon from "@mui/icons-material/Assessment";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { api } from "./api/client";
import type { ProjectsStateResponse } from "./types/api";
import { usePipelineStream } from "./hooks/usePipelineStream";
import { ProjectDialog } from "./components/projects/ProjectDialog";
import { ConfigPage } from "./features/config/ConfigPage";
import { SamplesheetPage } from "./features/samplesheet/SamplesheetPage";
import { PipelinePage } from "./features/pipeline/PipelinePage";
import { ResultsPage } from "./features/results/ResultsPage";

type ActiveTab = "config" | "samplesheet" | "pipeline" | "results";

interface ToastState {
  open: boolean;
  message: string;
  severity: "success" | "error" | "info" | "warning";
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("config");
  const [projectsState, setProjectsState] = useState<ProjectsStateResponse | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState<boolean>(false);
  const [projectDialogTab, setProjectDialogTab] = useState<number>(0);
  const [toast, setToast] = useState<ToastState>({
    open: false,
    message: "",
    severity: "info",
  });

  const stream = usePipelineStream();

  const notify = useCallback(
    (
      message: string,
      severity: "success" | "error" | "info" | "warning" = "info"
    ) => {
      setToast({ open: true, message, severity });
    },
    []
  );

  const loadProjects = useCallback(async () => {
    try {
      const res = await api.getProjectsState();
      setProjectsState(res);
      if (!res.current.has_config) {
        setProjectDialogTab(0);
        setProjectDialogOpen(true);
      }
    } catch (err) {
      notify(
        err instanceof Error ? err.message : "Failed to load project state",
        "error"
      );
    }
  }, [notify]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  const handleOpenProjectModal = (tabIdx: number) => {
    setProjectDialogTab(tabIdx);
    setProjectDialogOpen(true);
  };

  const handleQuitServer = async () => {
    const isRunning = stream.status === "running";
    const msg = isRunning
      ? "A Nextflow pipeline is currently running! Force stop the pipeline and shut down the server?"
      : "Shut down the CUT&RUN Control Center web server?";
    if (!window.confirm(msg)) return;
    try {
      await api.shutdownServer(isRunning);
      notify("Server is shutting down...", "info");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Shutdown failed", "error");
    }
  };

  const currentProjectPath = projectsState?.current.path ?? "";
  const currentProjectLabel = projectsState?.current.label ?? "No Project Selected";
  const currentExperiment = projectsState?.current.experiment ?? "";

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: "column", bgcolor: "background.default" }}>
      {/* Top Google Material UI AppBar */}
      <AppBar
        position="sticky"
        color="default"
        elevation={0}
        sx={{
          bgcolor: "background.paper",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ gap: 2, flexWrap: "wrap", py: 1 }}>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mr: 2 }}>
            <Box
              sx={{
                width: 38,
                height: 38,
                borderRadius: 2,
                bgcolor: "primary.main",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ScienceIcon />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ lineHeight: 1.2, fontWeight: 700 }}>
                CUT&amp;RUN Control Center
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Nextflow Downstream Peak &amp; Motif Pipeline
              </Typography>
            </Box>
          </Stack>

          {/* Active Project Selector Pill */}
          <Paper
            variant="outlined"
            sx={{
              px: 1.5,
              py: 0.5,
              display: "flex",
              alignItems: "center",
              gap: 1,
              bgcolor: "#f8fafc",
            }}
          >
            <FolderOpenIcon color="primary" fontSize="small" />
            <Box>
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {currentProjectLabel}
                </Typography>
                {currentExperiment && (
                  <Chip
                    label={currentExperiment}
                    size="small"
                    color="primary"
                    variant="outlined"
                    sx={{ height: 20, fontSize: "0.72rem" }}
                  />
                )}
              </Stack>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", maxWidth: 340 }}
                noWrap
              >
                {currentProjectPath}
              </Typography>
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ ml: 1 }}>
              <Button
                size="small"
                variant="outlined"
                onClick={() => handleOpenProjectModal(0)}
              >
                Switch / Open
              </Button>
              <Button
                size="small"
                variant="contained"
                startIcon={<AddCircleOutlineIcon fontSize="small" />}
                onClick={() => handleOpenProjectModal(1)}
              >
                New Project
              </Button>
              <Tooltip title="Manage Project Templates (~/.config/cutandrun_web)">
                <Button
                  size="small"
                  variant="text"
                  startIcon={<BookmarkBorderIcon fontSize="small" />}
                  onClick={() => handleOpenProjectModal(2)}
                >
                  Templates
                </Button>
              </Tooltip>
            </Stack>
          </Paper>

          <Box sx={{ flexGrow: 1 }} />

          {/* Live Pipeline Status & Server Controls */}
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              label={`Pipeline: ${stream.status.toUpperCase()}`}
              color={
                stream.status === "running"
                  ? "primary"
                  : stream.status === "completed"
                    ? "success"
                    : stream.status === "failed"
                      ? "error"
                      : "default"
              }
              size="small"
              onClick={() => setActiveTab("pipeline")}
            />
            <Tooltip title="Shut down background server">
              <Button
                size="small"
                color="inherit"
                 variant="outlined"
                startIcon={<PowerSettingsNewIcon fontSize="small" />}
                onClick={() => void handleQuitServer()}
              >
                Quit
              </Button>
            </Tooltip>
          </Stack>
        </Toolbar>

        {/* Primary Feature Navigation Tabs */}
        <Container maxWidth="xl">
          <Tabs
            value={activeTab}
            onChange={(_, v: ActiveTab) => setActiveTab(v)}
            textColor="primary"
            indicatorColor="primary"
          >
            <Tab
              value="config"
              icon={<TuneIcon fontSize="small" />}
              iconPosition="start"
              label="1. Experiment Config & Contrasts"
            />
            <Tab
              value="samplesheet"
              icon={<TableChartIcon fontSize="small" />}
              iconPosition="start"
              label="1b. Samplesheet (CSV)"
            />
            <Tab
              value="pipeline"
              icon={<PlayCircleOutlineIcon fontSize="small" />}
              iconPosition="start"
              label="2. Run Script & Pipeline Monitor"
            />
            <Tab
              value="results"
              icon={<AssessmentIcon fontSize="small" />}
              iconPosition="start"
              label="3. Results Directory & QC"
            />
          </Tabs>
        </Container>
      </AppBar>

      {/* Main Content Area */}
      <Container maxWidth="xl" sx={{ py: 3, flexGrow: 1 }}>
        {!projectsState?.current.has_config ? (
          <Alert
            severity="warning"
            action={
              <Stack direction="row" spacing={1}>
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => handleOpenProjectModal(0)}
                >
                  Open Existing
                </Button>
                <Button
                  variant="contained"
                  size="small"
                  onClick={() => handleOpenProjectModal(1)}
                >
                  Create from Template
                </Button>
              </Stack>
            }
          >
            Current directory (<code>{currentProjectPath}</code>) does not have a{" "}
            <code>config/experiment.config</code> file yet. Open an existing project or create a new
            project from a template.
          </Alert>
        ) : (
          <>
            {activeTab === "config" && (
              <ConfigPage projectPath={currentProjectPath} onNotify={notify} />
            )}
            {activeTab === "samplesheet" && (
              <SamplesheetPage projectPath={currentProjectPath} onNotify={notify} />
            )}
            {activeTab === "pipeline" && (
              <PipelinePage
                projectPath={currentProjectPath}
                stream={stream}
                onNotify={notify}
              />
            )}
            {activeTab === "results" && (
              <ResultsPage projectPath={currentProjectPath} onNotify={notify} />
            )}
          </>
        )}
      </Container>

      <ProjectDialog
        open={projectDialogOpen}
        initialTab={projectDialogTab}
        projectsState={projectsState}
        onClose={() => setProjectDialogOpen(false)}
        onProjectChanged={(nextState) => setProjectsState(nextState)}
        onNotify={notify}
      />

      <Snackbar
        open={toast.open}
        autoHideDuration={4500}
        onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          onClose={() => setToast((prev) => ({ ...prev, open: false }))}
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};
