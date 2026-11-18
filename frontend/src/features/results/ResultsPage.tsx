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
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
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
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ImageOutlinedIcon from "@mui/icons-material/ImageOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import HtmlOutlinedIcon from "@mui/icons-material/HtmlOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import { api } from "../../api/client";
import type { ResultFileItem } from "../../types/api";
import { CodeViewer } from "../../components/common/CodeSurface";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { EmptyState } from "../../components/common/EmptyState";
import { PageHeader } from "../../components/common/PageHeader";

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

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function renderFileTypeIcon(filename: string): React.ReactNode {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (["png", "svg", "jpg", "jpeg"].includes(ext)) {
    return <ImageOutlinedIcon fontSize="small" color="primary" />;
  }
  if (ext === "pdf") {
    return <PictureAsPdfOutlinedIcon fontSize="small" color="error" />;
  }
  if (ext === "html") {
    return <HtmlOutlinedIcon fontSize="small" color="secondary" />;
  }
  if (["txt", "tsv", "csv", "bed", "narrowpeak", "broadpeak", "md"].includes(ext)) {
    return <DescriptionOutlinedIcon fontSize="small" color="action" />;
  }
  return <InsertDriveFileOutlinedIcon fontSize="small" color="action" />;
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

  const [fileToDelete, setFileToDelete] = useState<ResultFileItem | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const loadFiles = async (resetSelection = false) => {
    setLoading(true);
    try {
      const res = await api.getResultsFiles();
      setFiles(res.files);
      setResultsDir(res.results_dir);
      setExists(res.exists);
      setSelectedFile((prev) => {
        if (resetSelection || !prev) {
          return res.files[0] ?? null;
        }
        return res.files.some((f) => f.path === prev.path) ? prev : (res.files[0] ?? null);
      });
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to load results", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedFile(null);
    setCategory("all");
    setSearch("");
    void loadFiles(true);
  }, [projectPath]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: files.length };
    for (const cat of CATEGORIES) {
      if (cat.id !== "all") counts[cat.id] = 0;
    }
    for (const f of files) {
      counts[f.category] = (counts[f.category] ?? 0) + 1;
    }
    return counts;
  }, [files]);

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

  const handleConfirmDeleteFile = async () => {
    if (!fileToDelete) return;
    setDeleting(true);
    try {
      await api.deleteResultFile(fileToDelete.path);
      const deletedName = fileToDelete.name;
      setFileToDelete(null);
      onNotify(`Deleted ${deletedName}`, "info");
      await loadFiles(false);
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to delete file", "error");
    } finally {
      setDeleting(false);
    }
  };

  const fileUrl = selectedFile
    ? `/api/results/file/${encodeURI(selectedFile.path)}`
    : "";
  const selectedExt = selectedFile?.name.split(".").pop()?.toLowerCase() ?? "";

  const splitPaneHeight = { xs: "auto", md: "calc(100vh - 300px)" };

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Results & QC Browser"
        badges={
          <Chip
            label={`${files.length} file${files.length === 1 ? "" : "s"}`}
            size="small"
            color="primary"
            variant="outlined"
          />
        }
        subtitle={
          <>
            Directory: <code>{resultsDir || `${projectPath}/results`}</code>
          </>
        }
        actions={
          <>
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
              onClick={() => void loadFiles(false)}
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
          </>
        }
      />

      <Paper variant="outlined" sx={{ px: 2 }}>
        <Tabs
          value={category}
          onChange={(_, v: string) => setCategory(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Result output categories"
        >
          {CATEGORIES.map((cat) => {
            const count = categoryCounts[cat.id] ?? 0;
            return (
              <Tab
                key={cat.id}
                value={cat.id}
                label={
                  <Stack direction="row" spacing={1} alignItems="center">
                    <span>{cat.label}</span>
                    <Chip
                      label={count}
                      size="small"
                      color={category === cat.id ? "primary" : "default"}
                      variant={category === cat.id ? "filled" : "outlined"}
                      sx={{ height: 20, fontSize: "0.72rem", fontVariantNumeric: "tabular-nums" }}
                    />
                  </Stack>
                }
              />
            );
          })}
        </Tabs>
      </Paper>

      {loading ? (
        <Grid container spacing={2.5}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Skeleton variant="rounded" height={520} />
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Skeleton variant="rounded" height={520} />
          </Grid>
        </Grid>
      ) : !exists || files.length === 0 ? (
        <Alert severity="info">
          No output files found in <code>{resultsDir || "results/"}</code> yet. Run the Nextflow
          pipeline to generate peak calls, metapeak plots, motif reports, and QC summaries.
        </Alert>
      ) : (
        <Grid container spacing={2.5}>
          {/* Left File List */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Card
              sx={{
                height: splitPaneHeight,
                minHeight: 460,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Box sx={{ p: 1.5 }}>
                <TextField
                  fullWidth
                  placeholder="Search output files..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: search ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Clear file search"
                            onClick={() => setSearch("")}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
              </Box>
              <Divider />
              <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
                {filteredFiles.length === 0 ? (
                  <EmptyState
                    title="No files in this category"
                    description={
                      search.trim()
                        ? `No files matching "${search}"`
                        : "Select another category tab above."
                    }
                  />
                ) : (
                  <List dense disablePadding>
                    {filteredFiles.map((item) => {
                      const isSelected = selectedFile?.path === item.path;
                      return (
                        <React.Fragment key={item.path}>
                          <ListItemButton
                            selected={isSelected}
                            onClick={() => setSelectedFile(item)}
                          >
                            <ListItemIcon sx={{ minWidth: 32 }}>
                              {renderFileTypeIcon(item.name)}
                            </ListItemIcon>
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
                )}
              </Box>
            </Card>
          </Grid>

          {/* Right Preview Pane */}
          <Grid size={{ xs: 12, md: 8 }}>
            <Card
              sx={{
                height: splitPaneHeight,
                minHeight: 460,
                display: "flex",
                flexDirection: "column",
              }}
            >
              {selectedFile ? (
                <>
                  <CardHeader
                    sx={{ "& .MuiCardHeader-content": { minWidth: 0 } }}
                    title={
                      <Tooltip title={selectedFile.name} placement="top-start">
                        <Typography variant="subtitle1" noWrap>
                          {selectedFile.name}
                        </Typography>
                      </Tooltip>
                    }
                    subheader={
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                        {selectedFile.path} ({formatBytes(selectedFile.size)})
                      </Typography>
                    }
                    action={
                      <Stack direction="row" spacing={1} sx={{ flexShrink: 0, ml: 1 }}>
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
                            aria-label={`Delete file ${selectedFile.name}`}
                            onClick={() => setFileToDelete(selectedFile)}
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
                      bgcolor: "background.default",
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
                          bgcolor: "background.paper",
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
                          bgcolor: "background.paper",
                          borderRadius: 1,
                        }}
                      />
                    ) : loadingPreview ? (
                      <CircularProgress size={28} />
                    ) : (
                      <CodeViewer
                        sx={{ width: "100%", height: "100%", borderRadius: 1 }}
                      >
                        {textPreview || "Preview not available for this file type."}
                      </CodeViewer>
                    )}
                  </CardContent>
                </>
              ) : (
                <EmptyState
                  title="No file selected"
                  description="Select a file from the left panel to preview it."
                  sx={{ height: "100%" }}
                />
              )}
            </Card>
          </Grid>
        </Grid>
      )}

      <ConfirmDialog
        open={fileToDelete !== null}
        title="Delete Output File?"
        message={
          fileToDelete ? (
            <>
              Permanently delete output file <code>{fileToDelete.path}</code>?
            </>
          ) : (
            ""
          )
        }
        confirmLabel="Delete File"
        confirmColor="error"
        busy={deleting}
        onConfirm={() => void handleConfirmDeleteFile()}
        onCancel={() => setFileToDelete(null)}
      />
    </Stack>
  );
};
