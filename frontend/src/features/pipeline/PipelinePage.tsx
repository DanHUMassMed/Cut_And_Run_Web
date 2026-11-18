import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Collapse,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import PlayArrowIcon from "@mui/icons-material/PlayArrow";
import StopIcon from "@mui/icons-material/Stop";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import SaveIcon from "@mui/icons-material/Save";
import RestartAltIcon from "@mui/icons-material/RestartAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteSweepIcon from "@mui/icons-material/DeleteSweep";
import TerminalIcon from "@mui/icons-material/Terminal";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ArrowDownwardIcon from "@mui/icons-material/ArrowDownward";
import { api } from "../../api/client";
import type { PipelineStreamState } from "../../hooks/usePipelineStream";
import type { PreflightResponse } from "../../types/api";
import { CodeEditor, CodeViewer } from "../../components/common/CodeSurface";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";
import { MONOSPACE_FONT_FAMILY } from "../../theme/theme";

export interface PipelinePageProps {
  projectPath: string;
  stream: PipelineStreamState;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

type TaskStatusFilter = "all" | "running" | "failed" | "completed" | "cached";

export function formatElapsed(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) {
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function statusChipColor(
  status: string
): "default" | "primary" | "success" | "error" | "warning" | "info" {
  const upper = status.toUpperCase();
  if (upper === "RUNNING") return "primary";
  if (upper === "COMPLETED") return "success";
  if (upper === "CACHED") return "info";
  if (upper === "FAILED" || upper === "ABORTED") return "error";
  if (upper === "CANCELLED" || upper === "SUBMITTED") return "warning";
  return "default";
}

export const PipelinePage: React.FC<PipelinePageProps> = ({
  projectPath,
  stream,
  onNotify,
}) => {
  const [runShContent, setRunShContent] = useState<string>("");
  const [savedRunSh, setSavedRunSh] = useState<string>("");
  const [runShPath, setRunShPath] = useState<string>("");
  const [scriptExpanded, setScriptExpanded] = useState<boolean>(false);
  const [savingScript, setSavingScript] = useState<boolean>(false);

  const [resumeFlag, setResumeFlag] = useState<boolean>(true);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState<boolean>(false);
  const [launching, setLaunching] = useState<boolean>(false);
  const [stopping, setStopping] = useState<boolean>(false);

  const [taskStatusFilter, setTaskStatusFilter] = useState<TaskStatusFilter>("all");
  const [taskSearch, setTaskSearch] = useState<string>("");

  const [logFilter, setLogFilter] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLPreElement | null>(null);

  const isRunning = stream.status === "running";

  const loadRunScript = async () => {
    try {
      const res = await api.getRunScript();
      setRunShContent(res.content);
      setSavedRunSh(res.content);
      setRunShPath(res.path);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to load run.sh", "error");
    }
  };

  useEffect(() => {
    void loadRunScript();
    setPreflight(null);
  }, [projectPath]);

  useEffect(() => {
    if (isRunning) {
      setScriptExpanded(false);
    }
  }, [isRunning]);

  const isScriptDirty = runShContent !== savedRunSh;

  const filteredTasks = useMemo(() => {
    const q = taskSearch.trim().toLowerCase();
    return stream.tasks.filter((task) => {
      const upperStatus = task.status.toUpperCase();
      if (taskStatusFilter === "running" && upperStatus !== "RUNNING" && upperStatus !== "SUBMITTED") {
        return false;
      }
      if (taskStatusFilter === "failed" && upperStatus !== "FAILED" && upperStatus !== "ABORTED") {
        return false;
      }
      if (taskStatusFilter === "completed" && upperStatus !== "COMPLETED") {
        return false;
      }
      if (taskStatusFilter === "cached" && upperStatus !== "CACHED") {
        return false;
      }
      if (q) {
        const proc = (task.process_short || task.process || "").toLowerCase();
        const tag = (task.tag || "").toLowerCase();
        const hash = (task.hash || task.task_id || "").toLowerCase();
        return proc.includes(q) || tag.includes(q) || hash.includes(q);
      }
      return true;
    });
  }, [stream.tasks, taskStatusFilter, taskSearch]);

  const filteredLogs = useMemo(() => {
    if (!logFilter.trim()) return stream.logs;
    const q = logFilter.toLowerCase();
    return stream.logs.filter((line) => line.toLowerCase().includes(q));
  }, [stream.logs, logFilter]);

  const scrollToBottom = () => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    if (autoScroll) {
      scrollToBottom();
    }
  }, [filteredLogs, autoScroll]);

  const handleSaveRunScript = async () => {
    setSavingScript(true);
    try {
      const res = await api.saveRunScript(runShContent);
      setRunShContent(res.content);
      setSavedRunSh(res.content);
      onNotify("Saved run.sh with executable permissions (+x)", "success");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to save run.sh", "error");
    } finally {
      setSavingScript(false);
    }
  };

  const handleResetRunScript = async () => {
    setSavingScript(true);
    try {
      const res = await api.resetRunScript("default_ce11");
      setRunShContent(res.content);
      setSavedRunSh(res.content);
      onNotify("Reset run.sh to default template", "info");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to reset run.sh", "error");
    } finally {
      setSavingScript(false);
    }
  };

  const handleRunPreflight = async () => {
    setCheckingPreflight(true);
    try {
      const res = await api.runPreflight();
      setPreflight(res);
      onNotify(
        res.ready
          ? "Pre-flight check passed: ready to launch"
          : "Pre-flight check reported blocking issues",
        res.ready ? "success" : "warning"
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Pre-flight check failed", "error");
    } finally {
      setCheckingPreflight(false);
    }
  };

  const handleStartPipeline = async () => {
    setLaunching(true);
    try {
      if (isScriptDirty) {
        await api.saveRunScript(runShContent);
        setSavedRunSh(runShContent);
      }
      await api.startPipeline(resumeFlag);
      const statusSnap = await api.getPipelineStatus();
      stream.refreshFromStatus(statusSnap);
      onNotify(
        `Launched Nextflow pipeline (${resumeFlag ? "-resume" : "fresh run"})`,
        "success"
      );
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to start pipeline", "error");
    } finally {
      setLaunching(false);
    }
  };

  const handleStopPipeline = async () => {
    setStopping(true);
    try {
      await api.stopPipeline();
      const statusSnap = await api.getPipelineStatus();
      stream.refreshFromStatus(statusSnap);
      onNotify("Sent interrupt signal to stop pipeline", "warning");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to stop pipeline", "error");
    } finally {
      setStopping(false);
    }
  };

  const handleCopyLogs = async () => {
    try {
      await navigator.clipboard.writeText(filteredLogs.join(""));
      onNotify("Copied pipeline logs to clipboard", "info");
    } catch {
      onNotify("Failed to copy logs", "error");
    }
  };

  const isIndeterminate = isRunning && stream.stats.total === 0;
  const progressBarColor: "primary" | "success" | "error" =
    stream.status === "completed"
      ? "success"
      : stream.status === "failed"
        ? "error"
        : "primary";

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Pipeline Runner & Live Monitor"
        badges={
          <>
            <Chip
              label={stream.status.toUpperCase()}
              color={statusChipColor(stream.status)}
              size="small"
            />
            {stream.runName && (
              <Chip label={`Run: ${stream.runName}`} size="small" variant="outlined" />
            )}
            <Chip
              label={`Elapsed: ${formatElapsed(stream.elapsedSeconds)}`}
              size="small"
              variant="outlined"
              sx={{ fontVariantNumeric: "tabular-nums" }}
            />
          </>
        }
        subtitle={
          <>
            Script: <code>{runShPath || `${projectPath}/run.sh`}</code>
          </>
        }
        actions={
          <>
            <FormControlLabel
              control={
                <Checkbox
                  size="small"
                  checked={resumeFlag}
                  disabled={isRunning}
                  onChange={(e) => setResumeFlag(e.target.checked)}
                />
              }
              label={
                <Typography variant="body2">
                  Use Nextflow <code>-resume</code> cache
                </Typography>
              }
            />
            <Button
              variant="outlined"
              startIcon={
                checkingPreflight ? (
                  <CircularProgress size={16} color="inherit" />
                ) : (
                  <FactCheckIcon />
                )
              }
              disabled={checkingPreflight}
              onClick={() => void handleRunPreflight()}
            >
              {checkingPreflight ? "Checking..." : "Pre-Flight Check"}
            </Button>
            {!isRunning ? (
              <Button
                variant="contained"
                color="success"
                startIcon={
                  launching ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />
                }
                disabled={launching}
                onClick={() => void handleStartPipeline()}
              >
                {launching ? "Starting..." : "Launch Pipeline"}
              </Button>
            ) : (
              <Button
                variant="contained"
                color="error"
                startIcon={
                  stopping ? <CircularProgress size={16} color="inherit" /> : <StopIcon />
                }
                disabled={stopping}
                onClick={() => void handleStopPipeline()}
              >
                {stopping ? "Stopping..." : "Stop Pipeline"}
              </Button>
            )}
          </>
        }
      />

      {/* Pre-Flight Results Banner */}
      {preflight && (
        <Card>
          <CardHeader
            title={
              <Stack direction="row" spacing={1.5} alignItems="center">
                <Typography variant="subtitle1">Pre-Flight Validation Results</Typography>
                <Chip
                  label={preflight.ready ? "Ready" : "Action Required"}
                  color={preflight.ready ? "success" : "error"}
                  size="small"
                />
              </Stack>
            }
          />
          <Divider />
          <CardContent>
            <Grid container spacing={1.5}>
              {preflight.checks.map((chk, idx) => (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={idx}>
                  <Alert
                    severity={
                      chk.status === "ok"
                        ? "success"
                        : chk.status === "warning"
                          ? "warning"
                          : "error"
                    }
                    sx={{ height: "100%" }}
                  >
                    <Typography variant="subtitle2">{chk.name}</Typography>
                    <Typography variant="caption" sx={{ wordBreak: "break-all" }}>
                      {chk.detail}
                    </Typography>
                  </Alert>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      {/* 1. Progress KPIs & Progress Bar (Prominent below launch bar) */}
      <Card>
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2" sx={{ fontVariantNumeric: "tabular-nums" }}>
                Workflow Execution Progress ({stream.stats.percent}%)
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontVariantNumeric: "tabular-nums" }}
              >
                {stream.stats.completed} / {stream.stats.total} tasks finished ({stream.stats.cached}{" "}
                cached)
              </Typography>
            </Stack>
            <LinearProgress
              variant={isIndeterminate ? "indeterminate" : "determinate"}
              color={progressBarColor}
              value={
                isIndeterminate
                  ? undefined
                  : Math.min(100, Math.max(0, stream.stats.percent))
              }
              sx={{ height: 10, borderRadius: 5 }}
            />
            <Grid container spacing={2}>
              {[
                { label: "Total Tasks", value: stream.stats.total, color: "text.primary" },
                { label: "Submitted", value: stream.stats.submitted, color: "warning.main" },
                { label: "Running", value: stream.stats.running, color: "primary.main" },
                { label: "Completed", value: stream.stats.completed, color: "success.main" },
                { label: "Cached", value: stream.stats.cached, color: "info.main" },
                { label: "Failed", value: stream.stats.failed, color: "error.main" },
              ].map((metric) => (
                <Grid size={{ xs: 6, sm: 4, md: 2 }} key={metric.label}>
                  <Paper variant="outlined" sx={{ p: 1.5, textAlign: "center" }}>
                    <Typography variant="caption" color="text.secondary">
                      {metric.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{
                        color: metric.color,
                        mt: 0.5,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {metric.value}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* 2. run.sh Script Editor Card (Collapsed by default) */}
      <Card>
        <CardHeader
          title={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TerminalIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1">Launch Script (run.sh)</Typography>
              <Chip
                label={isScriptDirty ? "Unsaved Edits" : "Saved"}
                size="small"
                color={isScriptDirty ? "warning" : "success"}
                variant={isScriptDirty ? "filled" : "outlined"}
              />
            </Stack>
          }
          action={
            <Stack direction="row" spacing={1}>
              {scriptExpanded && (
                <>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<RestartAltIcon />}
                    disabled={savingScript || isRunning}
                    onClick={() => void handleResetRunScript()}
                  >
                    Reset to Template
                  </Button>
                  <Button
                    size="small"
                    variant="contained"
                    startIcon={
                      savingScript ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />
                    }
                    disabled={savingScript || !isScriptDirty}
                    onClick={() => void handleSaveRunScript()}
                  >
                    Save run.sh
                  </Button>
                </>
              )}
              <Button
                size="small"
                color="inherit"
                endIcon={scriptExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setScriptExpanded((prev) => !prev)}
              >
                {scriptExpanded ? "Hide Script" : "Edit run.sh"}
              </Button>
            </Stack>
          }
        />
        <Collapse in={scriptExpanded}>
          <Divider />
          <CardContent>
            <CodeEditor
              minRows={8}
              maxRows={18}
              value={runShContent}
              onChange={(e) => setRunShContent(e.target.value)}
            />
          </CardContent>
        </Collapse>
      </Card>

      {/* 3. Nextflow Task Table */}
      <Card>
        <CardHeader
          title={`Process Execution Table (${filteredTasks.length} / ${stream.tasks.length})`}
          subheader="Real-time task telemetry via Nextflow weblog and execution trace"
          action={
            stream.tasks.length > 0 ? (
              <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                <ToggleButtonGroup
                  size="small"
                  exclusive
                  color="primary"
                  value={taskStatusFilter}
                  onChange={(_, val: TaskStatusFilter | null) => {
                    if (val) setTaskStatusFilter(val);
                  }}
                  aria-label="Filter tasks by status"
                >
                  <ToggleButton value="all">All</ToggleButton>
                  <ToggleButton value="running">Running</ToggleButton>
                  <ToggleButton value="failed">Failed</ToggleButton>
                  <ToggleButton value="completed">Completed</ToggleButton>
                  <ToggleButton value="cached">Cached</ToggleButton>
                </ToggleButtonGroup>
                <TextField
                  placeholder="Search process or tag..."
                  value={taskSearch}
                  onChange={(e) => setTaskSearch(e.target.value)}
                  sx={{ width: 210 }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: taskSearch ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Clear task search"
                            onClick={() => setTaskSearch("")}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              </Stack>
            ) : undefined
          }
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          {stream.tasks.length === 0 ? (
            <EmptyState
              title="No tasks recorded for the current session yet"
              description="Launch the pipeline to monitor Nextflow processes in real time."
            />
          ) : filteredTasks.length === 0 ? (
            <EmptyState
              title="No tasks match the current filter"
              action={
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => {
                    setTaskStatusFilter("all");
                    setTaskSearch("");
                  }}
                >
                  Reset Task Filters
                </Button>
              }
            />
          ) : (
            <TableContainer sx={{ maxHeight: 360 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Hash</TableCell>
                    <TableCell>Process</TableCell>
                    <TableCell>Sample / Tag</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Exit</TableCell>
                    <TableCell>Duration</TableCell>
                    <TableCell>CPU %</TableCell>
                    <TableCell>Peak RSS</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredTasks.map((task) => (
                    <TableRow key={task.key} hover>
                      <TableCell
                        sx={{
                          fontFamily: MONOSPACE_FONT_FAMILY,
                          fontSize: "0.78rem",
                        }}
                      >
                        {task.hash || task.task_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>
                        {task.process_short || task.process}
                      </TableCell>
                      <TableCell>{task.tag || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={task.status}
                          size="small"
                          color={statusChipColor(task.status)}
                        />
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {task.exit !== null ? task.exit : "—"}
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {task.duration ||
                          task.realtime_fmt ||
                          (task.realtime ? `${(Number(task.realtime) / 1000).toFixed(1)}s` : "—")}
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {task.cpu_percent ? `${task.cpu_percent.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell sx={{ fontVariantNumeric: "tabular-nums" }}>
                        {task.peak_rss || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. Live Console Output */}
      <Card>
        <CardHeader
          title="Nextflow Live Output Console"
          action={
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <TextField
                placeholder="Filter logs..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                sx={{ width: 220 }}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                    endAdornment: logFilter ? (
                      <InputAdornment position="end">
                        <IconButton
                          size="small"
                          aria-label="Clear log filter"
                          onClick={() => setLogFilter("")}
                        >
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : undefined,
                  },
                }}
              />
              <FormControlLabel
                control={
                  <Checkbox
                    size="small"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                  />
                }
                label={<Typography variant="caption">Auto-scroll</Typography>}
              />
              {!autoScroll && (
                <Button
                  size="small"
                  variant="outlined"
                  startIcon={<ArrowDownwardIcon fontSize="small" />}
                  onClick={() => {
                    setAutoScroll(true);
                    scrollToBottom();
                  }}
                >
                  Jump to Bottom
                </Button>
              )}
              <Button
                size="small"
                variant="outlined"
                startIcon={<ContentCopyIcon />}
                onClick={() => void handleCopyLogs()}
              >
                Copy
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="inherit"
                startIcon={<DeleteSweepIcon />}
                onClick={stream.clearLogs}
              >
                Clear
              </Button>
            </Stack>
          }
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          <Box sx={{ p: 0 }}>
            <CodeViewer
              ref={logContainerRef}
              height={380}
              wrap
              sx={{ borderRadius: 0 }}
            >
              {filteredLogs.length === 0
                ? "Waiting for Nextflow console output..."
                : filteredLogs.join("")}
            </CodeViewer>
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};
