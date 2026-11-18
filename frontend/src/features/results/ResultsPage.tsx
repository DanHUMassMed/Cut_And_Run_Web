import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  CircularProgress,
  Divider,
  Grid2 as Grid,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import RefreshIcon from "@mui/icons-material/Refresh";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import DownloadIcon from "@mui/icons-material/Download";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { api } from "../../api/client";
import type { ResultFileItem } from "../../types/api";

export interface ResultsPageProps {
  projectPath: string;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

const CATEGORIES = [
  { id: "all", label: "All Outputs" },
  { id: "15_summary_plots", label: "Summary QC Plots (PNG)" },
  { id: "13_metapeak_plots", label: "Metapeak Tornado Plots (PDF)" },
  { id: "14_motifs", label: "Motif Discovery (HTML)" },
  { id: "12_differential_peaks", label: "Differential Peaks" },
  { id: "11_peak_quantification", label: "Peak Annotations" },
  { id: "09_peaks", label: "Called Peaks" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export const ResultsPage: React.FC<ResultsPageProps> = ({ projectPath, onNotify }) => {
  const [files, setFiles] = useState<ResultFileItem[]>([]);
  const [resultsDir, setResultsDir] = useState<string>("");
  const [exists, setExists] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [category, setCategory] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<ResultFileItem | null>(null);
  const [textPreview, setTextPreview] = useState<string>("");
  const [loadingPreview, setLoadingPreview] = useState<boolean>(false);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const res = await api.getResultsFiles();
      setFiles(res.files);
      setResultsDir(res.results_dir);
      setExists(res.exists);
      if (res.files.length > 0 && !selectedFile) {
        setSelectedFile(res.files[0]);
      } else if (
        selectedFile &&
        !res.files.some((f) => f.path === selectedFile.path)
      ) {
        setSelectedFile(res.files[0] ?? null);
      }
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to load results", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadFiles();
  }, [projectPath]);

  const filteredFiles = useMemo(() => {
    return files.filter((file) => {
      if (category !== "all" && file.category !== category) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return (
          file.name.toLowerCase().includes(q) ||
          file.path.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [files, category, search]);

  useEffect(() => {
    if (!selectedFile) {
      setTextPreview("");
      return;
    }
    const ext = selectedFile.name.split(".").pop()?.toLowerCase() ?? "";
    const isTextLike = [
      "txt",
      "tsv",
      "csv",
      "bed",
      "narrowpeak",
      "broadpeak",
      "md",
    ].includes(ext);

    if (!isTextLike) {
      setTextPreview("");
      return;
    }

    let cancelled = false;
    setLoadingPreview(true);
    fetch(`/api/results/file/${encodeURI(selectedFile.path)}`)
      .then((r) => r.text())
      .then((txt) => {
        if (!cancelled) {
          setTextPreview(txt.slice(0, 60000));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTextPreview("Unable to load text preview.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedFile]);

  const handleOpenFinder = async () => {
    try {
      const res = await api.openResultsInFinder();
      onNotify(`Opened ${res.path} in Finder`, "info");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Could not open Finder", "error");
    }
  };

  const handleCopyPath = async () => {
    if (!resultsDir) return;
    try {
      await navigator.clipboard.writeText(resultsDir);
      onNotify("Copied results directory path", "info");
    } catch {
      onNotify("Could not copy path", "error");
    }
  };

  const handleDeleteFile = async (item: ResultFileItem) => {
    if (!window.confirm(`Delete output file "${item.path}"?`)) return;
    try {
      await api.deleteResultFile(item.path);
      onNotify(`Deleted ${item.name}`, "info");
      await loadFiles();
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to delete file", "error");
    }
  };

  const fileUrl = selectedFile
    ? `/api/results/file/${encodeURI(selectedFile.path)}`
    : "";
  const selectedExt = selectedFile?.name.split(".").pop()?.toLowerCase() ?? "";

  return (
    <Stack spacing={3}>
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
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h6">Results &amp; QC Browser</Typography>
            <Chip label={`${files.length} files`} size="small" color="primary" variant="outlined" />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Directory: <code>{resultsDir || `${projectPath}/results`}</code>
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            size="small"
            startIcon={<ContentCopyIcon />}
            disabled={!resultsDir}
            onClick={() => void handleCopyPath()}
          >
            Copy Path
          </Button>
          <Button
            variant="outlined"
            size="small"
            startIcon={<RefreshIcon />}
            onClick={() => void loadFiles()}
          >
            Refresh
          </Button>
          <Button
            variant="contained"
            size="small"
            startIcon={<FolderOpenIcon />}
            onClick={() => void handleOpenFinder()}
          >
            Open in Finder
          </Button>
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ px: 2 }}>
        <Tabs
          value={category}
          onChange={(_, v: string) => setCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
        >
          {CATEGORIES.map((cat) => (
            <Tab key={cat.id} value={cat.id} label={cat.label} />
          ))}
        </Tabs>
      </Paper>

      {loading ? (
        <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
          <CircularProgress />
        </Stack>
      ) : !exists || files.length === 0 ? (
        <Alert severity="info">
          No output files found in <code>{resultsDir || "results/"}</code> yet. Run the Nextflow
          pipeline to generate peak calls, metapeak plots, motif reports, and QC summaries.
        </Alert>
      ) : (
        <Grid container spacing={2.5}>
          {/* Left File List */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card variant="outlined" sx={{ height: 640, display: "flex", flexDirection: "column" }}>
              <Box sx={{ p: 1.5 }}>
                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search output files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </Box>
              <Divider />
              <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
                <List dense disablePadding>
                  {filteredFiles.map((item) => {
                    const isSelected = selectedFile?.path === item.path;
                    return (
                      <React.Fragment key={item.path}>
                        <ListItemButton
                          selected={isSelected}
                          onClick={() => setSelectedFile(item)}
                        >
                          <ListItemText
                            primary={item.name}
                            secondary={`${item.subfolder || item.category} • ${formatBytes(item.size)}`}
                            primaryTypographyProps={{
                              noWrap: true,
                              fontWeight: isSelected ? 600 : 400,
                            }}
                            secondaryTypographyProps={{ noWrap: true }}
                          />
                        </ListItemButton>
                        <Divider component="li" />
                      </React.Fragment>
                    );
                  })}
                </List>
              </Box>
            </Card>
          </Grid>

          {/* Right Preview Pane */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card variant="outlined" sx={{ height: 640, display: "flex", flexDirection: "column" }}>
              {selectedFile ? (
                <>
                  <CardHeader
                    title={
                      <Typography variant="subtitle1" noWrap>
                        {selectedFile.name}
                      </Typography>
                    }
                    subheader={`${selectedFile.path} (${formatBytes(selectedFile.size)})`}
                    action={
                      <Stack direction="row" spacing={1}>
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          startIcon={<OpenInNewIcon />}
                        >
                          Open Tab
                        </Button>
                        <Button
                          size="small"
                          variant="outlined"
                          component="a"
                          href={fileUrl}
                          download={selectedFile.name}
                          startIcon={<DownloadIcon />}
                        >
                          Download
                        </Button>
                        <Tooltip title="Delete output file">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => void handleDeleteFile(selectedFile)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    }
                  />
                  <Divider />
                  <CardContent
                    sx={{
                      flexGrow: 1,
                      overflow: "auto",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: "#f8fafc",
                      p: 2,
                    }}
                  >
                    {["png", "svg", "jpg", "jpeg"].includes(selectedExt) ? (
                      <Box
                        component="img"
                        src={fileUrl}
                        alt={selectedFile.name}
                        sx={{
                          maxWidth: "100%",
                          maxHeight: "100%",
                          objectFit: "contain",
                          borderRadius: 1,
                          boxShadow: 1,
                          bgcolor: "#fff",
                        }}
                      />
                    ) : ["pdf", "html"].includes(selectedExt) ? (
                      <Box
                        component="iframe"
                        src={fileUrl}
                        title={selectedFile.name}
                        sx={{
                          width: "100%",
                          height: "100%",
                          border: "none",
                          bgcolor: "#fff",
                          borderRadius: 1,
                        }}
                      />
                    ) : loadingPreview ? (
                      <CircularProgress size={28} />
                    ) : (
                      <Box
                        component="pre"
                        sx={{
                          m: 0,
                          p: 2,
                          width: "100%",
                          height: "100%",
                          overflow: "auto",
                          bgcolor: "#0f172a",
                          color: "#e2e8f0",
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.78rem",
                          borderRadius: 1,
                        }}
                      >
                        {textPreview || "Preview not available for this file type."}
                      </Box>
                    )}
                  </CardContent>
                </>
              ) : (
                <Stack alignItems="center" justifyContent="center" sx={{ height: "100%" }}>
                  <Typography variant="body2" color="text.secondary">
                    Select a file from the left panel to preview it.
                  </Typography>
                </Stack>
              )}
            </Card>
          </Grid>
        </Grid>
      )}
    </Stack>
  );
};
