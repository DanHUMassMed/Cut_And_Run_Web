import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Badge,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import ScienceIcon from "@mui/icons-material/Science";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import TuneIcon from "@mui/icons-material/Tune";
import TableChartIcon from "@mui/icons-material/TableChart";
import PlayCircleOutlineIcon from "@mui/icons-material/PlayCircleOutline";
import AssessmentIcon from "@mui/icons-material/Assessment";
import AdminPanelSettingsIcon from "@mui/icons-material/AdminPanelSettings";
import PowerSettingsNewIcon from "@mui/icons-material/PowerSettingsNew";
import { api } from "./api/client";
import type { ProjectsStateResponse } from "./types/api";
import { useNotification } from "./hooks/useNotification";
import { usePipelineStream } from "./hooks/usePipelineStream";
import { AppShell } from "./components/common/AppShell";
import { ConfirmDialog } from "./components/common/ConfirmDialog";
import { ProjectDialog } from "./components/projects/ProjectDialog";
import { ConfigPage } from "./features/config/ConfigPage";
import { SamplesheetPage } from "./features/samplesheet/SamplesheetPage";
import { PipelinePage } from "./features/pipeline/PipelinePage";
import { ResultsPage } from "./features/results/ResultsPage";

type ActiveTab = "config" | "samplesheet" | "pipeline" | "results";

type PendingNavigation =
  | { kind: "tab"; tab: ActiveTab }
  | { kind: "projectModal"; tabIdx: number };

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ActiveTab>("config");
  const [projectsState, setProjectsState] = useState<ProjectsStateResponse | null>(null);
  const [projectDialogOpen, setProjectDialogOpen] = useState<boolean>(false);
  const [projectDialogTab, setProjectDialogTab] = useState<number>(0);

  const [isConfigDirty, setIsConfigDirty] = useState<boolean>(false);
  const [isSamplesheetDirty, setIsSamplesheetDirty] = useState<boolean>(false);
  const [pendingNav, setPendingNav] = useState<PendingNavigation | null>(null);

  const [quitDialogOpen, setQuitDialogOpen] = useState<boolean>(false);
  const [shuttingDown, setShuttingDown] = useState<boolean>(false);

  const { toast, notify, closeToast } = useNotification();
  const stream = usePipelineStream();

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

  const hasActiveUnsavedChanges =
    (activeTab === "config" && isConfigDirty) ||
    (activeTab === "samplesheet" && isSamplesheetDirty);

  const requestTabChange = (nextTab: ActiveTab) => {
    if (nextTab === activeTab) return;
    if (hasActiveUnsavedChanges) {
      setPendingNav({ kind: "tab", tab: nextTab });
      return;
    }
    setActiveTab(nextTab);
  };

  const requestOpenProjectModal = (tabIdx: number) => {
    if (hasActiveUnsavedChanges) {
      setPendingNav({ kind: "projectModal", tabIdx });
      return;
    }
    setProjectDialogTab(tabIdx);
    setProjectDialogOpen(true);
  };

  const handleConfirmDiscardAndContinue = () => {
    if (!pendingNav) return;
    const action = pendingNav;
    setPendingNav(null);
    if (activeTab === "config") setIsConfigDirty(false);
    if (activeTab === "samplesheet") setIsSamplesheetDirty(false);

    if (action.kind === "tab") {
      setActiveTab(action.tab);
    } else {
      setProjectDialogTab(action.tabIdx);
      setProjectDialogOpen(true);
    }
  };

  const handleConfirmQuitServer = async () => {
    const isRunning = stream.status === "running";
    setShuttingDown(true);
    try {
      await api.shutdownServer(isRunning);
      setQuitDialogOpen(false);
      notify("Server is shutting down...", "info");
    } catch (err) {
      notify(err instanceof Error ? err.message : "Shutdown failed", "error");
    } finally {
      setShuttingDown(false);
    }
  };

  const currentProjectPath = projectsState?.current.path ?? "";
  const currentProjectLabel = projectsState?.current.label ?? "No Project Selected";
  const currentExperiment = projectsState?.current.experiment ?? "";
  const isPipelineRunning = stream.status === "running";

  const projectSelectorPill = (
    <Paper
      variant="outlined"
      sx={{
        px: 1.5,
        py: 0.5,
        display: "flex",
        alignItems: "center",
        gap: 1,
        bgcolor: "background.default",
      }}
    >
      <FolderOpenIcon color="primary" fontSize="small" />
      <Box sx={{ minWidth: 0 }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
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
        <Tooltip title={currentProjectPath} placement="bottom-start">
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", maxWidth: { xs: 180, sm: 280, md: 360 } }}
            noWrap
          >
            {currentProjectPath}
          </Typography>
        </Tooltip>
      </Box>
      <Button
        size="small"
        variant="contained"
        startIcon={<AddCircleOutlineIcon fontSize="small" />}
        onClick={() => requestOpenProjectModal(0)}
        sx={{ ml: 1, whiteSpace: "nowrap" }}
      >
        New/Open
      </Button>
    </Paper>
  );

  const headerActions = (
    <>
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
        onClick={() => requestTabChange("pipeline")}
      />
      <Tooltip title="Manage Project Templates (/admin)">
        <IconButton
          component="a"
          href="/admin"
          size="small"
          color="inherit"
          aria-label="Manage Project Templates"
        >
          <AdminPanelSettingsIcon fontSize="small" />
        </IconButton>
      </Tooltip>
      <Tooltip title="Shut down background server">
        <Button
          size="small"
          color="inherit"
          variant="outlined"
          startIcon={<PowerSettingsNewIcon fontSize="small" />}
          onClick={() => setQuitDialogOpen(true)}
        >
          Quit
        </Button>
      </Tooltip>
    </>
  );

  const navigationTabs = (
    <Tabs
      value={activeTab}
      onChange={(_, v: ActiveTab) => requestTabChange(v)}
      textColor="primary"
      indicatorColor="primary"
      variant="scrollable"
      scrollButtons="auto"
      aria-label="Primary workflow navigation"
    >
      <Tab
        value="config"
        icon={
          <Badge color="warning" variant="dot" invisible={!isConfigDirty}>
            <TuneIcon fontSize="small" />
          </Badge>
        }
        iconPosition="start"
        label="Configuration"
      />
      <Tab
        value="samplesheet"
        icon={
          <Badge color="warning" variant="dot" invisible={!isSamplesheetDirty}>
            <TableChartIcon fontSize="small" />
          </Badge>
        }
        iconPosition="start"
        label="Samplesheet"
      />
      <Tab
        value="pipeline"
        icon={
          <Badge
            color={stream.status === "failed" ? "error" : "primary"}
            variant="dot"
            invisible={stream.status !== "running" && stream.status !== "failed"}
          >
            <PlayCircleOutlineIcon fontSize="small" />
          </Badge>
        }
        iconPosition="start"
        label="Pipeline & Monitor"
      />
      <Tab
        value="results"
        icon={<AssessmentIcon fontSize="small" />}
        iconPosition="start"
        label="Results & QC"
      />
    </Tabs>
  );

  return (
    <AppShell
      icon={<ScienceIcon />}
      iconBgColor="primary.main"
      title="CUT&RUN Control Center"
      subtitle="Nextflow Downstream Peak & Motif Pipeline"
      headerCenter={projectSelectorPill}
      headerActions={headerActions}
      navigationTabs={navigationTabs}
      toast={toast}
      onCloseToast={closeToast}
    >
      {!projectsState?.current.has_config ? (
        <Alert
          severity="warning"
          action={
            <Stack direction="row" spacing={1}>
              <Button
                color="inherit"
                size="small"
                onClick={() => requestOpenProjectModal(0)}
              >
                Open Existing
              </Button>
              <Button
                variant="contained"
                size="small"
                onClick={() => requestOpenProjectModal(1)}
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
            <ConfigPage
              projectPath={currentProjectPath}
              onNotify={notify}
              onDirtyChange={setIsConfigDirty}
            />
          )}
          {activeTab === "samplesheet" && (
            <SamplesheetPage
              projectPath={currentProjectPath}
              onNotify={notify}
              onDirtyChange={setIsSamplesheetDirty}
            />
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

      <ProjectDialog
        open={projectDialogOpen}
        initialTab={projectDialogTab}
        projectsState={projectsState}
        onClose={() => setProjectDialogOpen(false)}
        onProjectChanged={(nextState) => {
          setIsConfigDirty(false);
          setIsSamplesheetDirty(false);
          setProjectsState(nextState);
        }}
        onNotify={notify}
      />

      <ConfirmDialog
        open={pendingNav !== null}
        title="Discard Unsaved Changes?"
        message="You have unsaved edits on the current tab. Switching away will discard those changes."
        confirmLabel="Discard & Continue"
        cancelLabel="Stay Here"
        confirmColor="warning"
        onConfirm={handleConfirmDiscardAndContinue}
        onCancel={() => setPendingNav(null)}
      />

      <ConfirmDialog
        open={quitDialogOpen}
        title="Shut Down Server?"
        message={
          isPipelineRunning
            ? "A Nextflow pipeline is currently running! Force stop the pipeline and shut down the web server?"
            : "Shut down the CUT&RUN Control Center background web server?"
        }
        confirmLabel={isPipelineRunning ? "Force Stop & Quit" : "Shut Down"}
        confirmColor="error"
        busy={shuttingDown}
        onConfirm={() => void handleConfirmQuitServer()}
        onCancel={() => setQuitDialogOpen(false)}
      />
    </AppShell>
  );
};
