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
  Collapse,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
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
import { api } from "../../api/client";
import type { PipelineStreamState } from "../../hooks/usePipelineStream";
import type { PreflightResponse } from "../../types/api";

export interface PipelinePageProps {
  projectPath: string;
  stream: PipelineStreamState;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

function formatElapsed(seconds: number): string {
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
  const [scriptExpanded, setScriptExpanded] = useState<boolean>(true);
  const [savingScript, setSavingScript] = useState<boolean>(false);

  const [resumeFlag, setResumeFlag] = useState<boolean>(true);
  const [preflight, setPreflight] = useState<PreflightResponse | null>(null);
  const [checkingPreflight, setCheckingPreflight] = useState<boolean>(false);
  const [launching, setLaunching] = useState<boolean>(false);
  const [stopping, setStopping] = useState<boolean>(false);

  const [logFilter, setLogFilter] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState<boolean>(true);
  const logContainerRef = useRef<HTMLDivElement | null>(null);

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

  const isScriptDirty = runShContent !== savedRunSh;

  const filteredLogs = useMemo(() => {
    if (!logFilter.trim()) return stream.logs;
    const q = logFilter.toLowerCase();
    return stream.logs.filter((line) => line.toLowerCase().includes(q));
  }, [stream.logs, logFilter]);

  useEffect(() => {
    if (autoScroll && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
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

  const isRunning = stream.status === "running";

  return (
    <Stack spacing={3}>
      {/* Top Launch & Control Bar */}
      <Paper
        variant="outlined"
        sx={{
          p: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
        }}
      >
        <Stack direction="row" spacing={2} alignItems="center" flexWrap="wrap">
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h6">Pipeline Runner &amp; Live Monitor</Typography>
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
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Script: <code>{runShPath || `${projectPath}/run.sh`}</code>
            </Typography>
          </Box>
        </Stack>

        <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
          <FormControlLabel
            control={
              <Checkbox
                size="small"
                checked={resumeFlag}
                disabled={isRunning}
                onChange={(e) => setResumeFlag(e.target.checked)}
              />
            }
            label={<Typography variant="body2">Use Nextflow <code>-resume</code> cache</Typography>}
          />
          <Button
            variant="outlined"
            startIcon={<FactCheckIcon />}
            disabled={checkingPreflight}
            onClick={() => void handleRunPreflight()}
          >
            {checkingPreflight ? "Checking..." : "Pre-Flight Check"}
          </Button>
          {!isRunning ? (
            <Button
              variant="contained"
              color="success"
              startIcon={<PlayArrowIcon />}
              disabled={launching}
              onClick={() => void handleStartPipeline()}
            >
              {launching ? "Starting..." : "Launch Pipeline"}
            </Button>
          ) : (
            <Button
              variant="contained"
              color="error"
              startIcon={<StopIcon />}
              disabled={stopping}
              onClick={() => void handleStopPipeline()}
            >
              {stopping ? "Stopping..." : "Stop Pipeline"}
            </Button>
          )}
        </Stack>
      </Paper>

      {/* Pre-Flight Results Banner */}
      {preflight && (
        <Card variant="outlined">
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

      {/* 1. run.sh Script Editor Card */}
      <Card variant="outlined">
        <CardHeader
          title={
            <Stack direction="row" spacing={1.5} alignItems="center">
              <TerminalIcon color="primary" fontSize="small" />
              <Typography variant="subtitle1">Manage Launch Script (run.sh)</Typography>
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
                startIcon={<SaveIcon />}
                disabled={savingScript || !isScriptDirty}
                onClick={() => void handleSaveRunScript()}
              >
                Save run.sh
              </Button>
              <Button
                size="small"
                color="inherit"
                endIcon={scriptExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                onClick={() => setScriptExpanded((prev) => !prev)}
              >
                {scriptExpanded ? "Hide" : "Show"}
              </Button>
            </Stack>
          }
        />
        <Collapse in={scriptExpanded}>
          <Divider />
          <CardContent>
            <TextField
              multiline
              minRows={8}
              maxRows={18}
              fullWidth
              value={runShContent}
              onChange={(e) => setRunShContent(e.target.value)}
              slotProps={{
                input: {
                  sx: {
                    fontFamily: '"JetBrains Mono", monospace',
                    fontSize: "0.84rem",
                    bgcolor: "#0f172a",
                    color: "#f8fafc",
                  },
                },
              }}
            />
          </CardContent>
        </Collapse>
      </Card>

      {/* 2. Progress KPIs & Progress Bar */}
      <Card variant="outlined">
        <CardContent>
          <Stack spacing={2}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <Typography variant="subtitle2">
                Workflow Execution Progress ({stream.stats.percent}%)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {stream.stats.completed} / {stream.stats.total} tasks finished ({stream.stats.cached}{" "}
                cached)
              </Typography>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, Math.max(0, stream.stats.percent))}
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
                    <Typography variant="h5" sx={{ color: metric.color, mt: 0.5 }}>
                      {metric.value}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* 3. Nextflow Task Table */}
      <Card variant="outlined">
        <CardHeader
          title={`Process Execution Table (${stream.tasks.length})`}
          subheader="Real-time task telemetry via Nextflow weblog and execution trace"
        />
        <Divider />
        <CardContent sx={{ p: 0 }}>
          {stream.tasks.length === 0 ? (
            <Box sx={{ p: 3, textAlign: "center" }}>
              <Typography variant="body2" color="text.secondary">
                No tasks recorded for the current session yet. Launch the pipeline to monitor
                processes in real time.
              </Typography>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: 340 }}>
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
                  {stream.tasks.map((task) => (
                    <TableRow key={task.key} hover>
                      <TableCell sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: "0.78rem" }}>
                        {task.hash || task.task_id}
                      </TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>{task.process_short || task.process}</TableCell>
                      <TableCell>{task.tag || "—"}</TableCell>
                      <TableCell>
                        <Chip
                          label={task.status}
                          size="small"
                          color={statusChipColor(task.status)}
                        />
                      </TableCell>
                      <TableCell>{task.exit !== null ? task.exit : "—"}</TableCell>
                      <TableCell>
                        {task.duration ||
                          task.realtime_fmt ||
                          (task.realtime ? `${(Number(task.realtime) / 1000).toFixed(1)}s` : "—")}
                      </TableCell>
                      <TableCell>
                        {task.cpu_percent ? `${task.cpu_percent.toFixed(1)}%` : "—"}
                      </TableCell>
                      <TableCell>{task.peak_rss || "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>

      {/* 4. Live Console Output */}
      <Card variant="outlined">
        <CardHeader
          title="Nextflow Live Output Console"
          action={
            <Stack direction="row" spacing={1} alignItems="center">
              <TextField
                size="small"
                placeholder="Filter logs..."
                value={logFilter}
                onChange={(e) => setLogFilter(e.target.value)}
                sx={{ width: 200 }}
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
          <Box
            ref={logContainerRef}
            component="pre"
            sx={{
              m: 0,
              p: 2,
              height: 380,
              overflowY: "auto",
              bgcolor: "#0f172a",
              color: "#e2e8f0",
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.8rem",
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {filteredLogs.length === 0
              ? "Waiting for Nextflow console output..."
              : filteredLogs.join("")}
          </Box>
        </CardContent>
      </Card>
    </Stack>
  );
};
