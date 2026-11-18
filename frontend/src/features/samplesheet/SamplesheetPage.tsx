import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import RestoreIcon from "@mui/icons-material/Restore";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileOutlinedIcon from "@mui/icons-material/UploadFileOutlined";
import { api } from "../../api/client";
import type { SamplesheetRow } from "../../types/api";
import { PageHeader } from "../../components/common/PageHeader";

export interface SamplesheetPageProps {
  projectPath: string;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export interface RowValidationError {
  sampleIdError?: string;
  controlIdError?: string;
}

export interface SamplesheetValidationResult {
  warnings: string[];
  rowErrors: Record<number, RowValidationError>;
}

const CSV_FIELDS: Array<keyof SamplesheetRow> = [
  "sample_id",
  "sample_name",
  "condition",
  "target",
  "peak_mode",
  "replicate",
  "control_id",
];

function splitCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

export function parseSamplesheetCsv(csvText: string): SamplesheetRow[] {
  const lines = csvText
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  if (lines.length === 0) return [];

  const firstCells = splitCsvLine(lines[0]);
  const lowerFirst = firstCells.map((c) => c.toLowerCase());
  const hasHeader = lowerFirst.includes("sample_id") || lowerFirst.includes("sample_name");

  const headerIndexMap: Record<keyof SamplesheetRow, number> = {
    sample_id: 0,
    sample_name: 1,
    condition: 2,
    target: 3,
    peak_mode: 4,
    replicate: 5,
    control_id: 6,
  };

  if (hasHeader) {
    for (const field of CSV_FIELDS) {
      const idx = lowerFirst.indexOf(field);
      if (idx !== -1) {
        headerIndexMap[field] = idx;
      }
    }
  }

  const startLine = hasHeader ? 1 : 0;
  const rows: SamplesheetRow[] = [];

  for (let i = startLine; i < lines.length; i += 1) {
    const cells = splitCsvLine(lines[i]);
    if (cells.every((c) => c === "")) continue;
    rows.push({
      sample_id: cells[headerIndexMap.sample_id] ?? "",
      sample_name: cells[headerIndexMap.sample_name] ?? "",
      condition: cells[headerIndexMap.condition] ?? "",
      target: cells[headerIndexMap.target] ?? "",
      peak_mode: cells[headerIndexMap.peak_mode] ?? "",
      replicate: cells[headerIndexMap.replicate] ?? "1",
      control_id: cells[headerIndexMap.control_id] ?? "",
    });
  }

  return rows;
}

export function validateSamplesheetRows(rows: SamplesheetRow[]): SamplesheetValidationResult {
  const warnings: string[] = [];
  const rowErrors: Record<number, RowValidationError> = {};
  const idCounts = new Map<string, number>();
  const allIds = new Set<string>();

  for (const row of rows) {
    const sid = row.sample_id.trim();
    if (sid) {
      allIds.add(sid);
      idCounts.set(sid, (idCounts.get(sid) ?? 0) + 1);
    }
  }

  const reportedDuplicates = new Set<string>();

  rows.forEach((row, index) => {
    const sid = row.sample_id.trim();
    const ctrl = row.control_id.trim();
    const entry: RowValidationError = {};

    if (!sid) {
      const msg = `Row ${index + 1}: sample_id is empty.`;
      warnings.push(msg);
      entry.sampleIdError = "sample_id is required";
    } else if ((idCounts.get(sid) ?? 0) > 1) {
      entry.sampleIdError = `Duplicate sample_id "${sid}"`;
      if (!reportedDuplicates.has(sid)) {
        warnings.push(`Row ${index + 1}: duplicate sample_id "${sid}".`);
        reportedDuplicates.add(sid);
      }
    }

    if (ctrl && !allIds.has(ctrl)) {
      const msg = `Row ${index + 1} (${sid || "unnamed"}): control_id "${ctrl}" does not match any sample_id in the table.`;
      warnings.push(msg);
      entry.controlIdError = `"${ctrl}" does not match any sample_id`;
    }

    if (entry.sampleIdError || entry.controlIdError) {
      rowErrors[index] = entry;
    }
  });

  return { warnings, rowErrors };
}

export const SamplesheetPage: React.FC<SamplesheetPageProps> = ({
  projectPath,
  onNotify,
  onDirtyChange,
}) => {
  const [rows, setRows] = useState<SamplesheetRow[]>([]);
  const [rowKeys, setRowKeys] = useState<string[]>([]);
  const [savedRows, setSavedRows] = useState<SamplesheetRow[]>([]);
  const [searchFilter, setSearchFilter] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const keyCounterRef = useRef<number>(1);
  const nextRowKey = () => {
    const k = `sample-row-${keyCounterRef.current}`;
    keyCounterRef.current += 1;
    return k;
  };

  const loadSamplesheet = async () => {
    setLoading(true);
    try {
      const res = await api.getSamplesheet();
      setRows(res.rows);
      setSavedRows(res.rows);
      setRowKeys(res.rows.map(() => nextRowKey()));
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Failed to load samplesheet.csv",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSamplesheet();
  }, [projectPath]);

  const isDirty = useMemo(
    () => JSON.stringify(rows) !== JSON.stringify(savedRows),
    [rows, savedRows]
  );

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const iggSampleIds = useMemo(() => {
    return rows
      .filter(
        (r) =>
          r.target.trim().toLowerCase() === "igg" ||
          r.sample_name.toLowerCase().includes("igg") ||
          r.peak_mode === ""
      )
      .map((r) => r.sample_id.trim())
      .filter(Boolean);
  }, [rows]);

  const { warnings: validationWarnings, rowErrors } = useMemo(
    () => validateSamplesheetRows(rows),
    [rows]
  );

  const indexedFilteredRows = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    return rows
      .map((row, index) => ({
        row,
        index,
        rowKey: rowKeys[index] ?? `sample-fallback-${index}`,
      }))
      .filter(({ row }) => {
        if (!q) return true;
        return (
          row.sample_id.toLowerCase().includes(q) ||
          row.sample_name.toLowerCase().includes(q) ||
          row.condition.toLowerCase().includes(q) ||
          row.target.toLowerCase().includes(q) ||
          row.control_id.toLowerCase().includes(q)
        );
      });
  }, [rows, rowKeys, searchFilter]);

  const handleUpdateRow = (
    index: number,
    field: keyof SamplesheetRow,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: value } : row))
    );
  };

  const handleAddRow = () => {
    setRowKeys((prev) => [...prev, nextRowKey()]);
    setRows((prev) => [
      ...prev,
      {
        sample_id: "",
        sample_name: "",
        condition: "",
        target: "H3K4me3",
        peak_mode: "narrow",
        replicate: "1",
        control_id: iggSampleIds[0] ?? "",
      },
    ]);
  };

  const handleDuplicateRow = (index: number) => {
    const source = rows[index];
    if (!source) return;
    const copy: SamplesheetRow = {
      ...source,
      sample_id: `${source.sample_id}_copy`,
    };
    setRowKeys((prev) => [
      ...prev.slice(0, index + 1),
      nextRowKey(),
      ...prev.slice(index + 1),
    ]);
    setRows((prev) => [
      ...prev.slice(0, index + 1),
      copy,
      ...prev.slice(index + 1),
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setRowKeys((prev) => prev.filter((_, idx) => idx !== index));
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDiscard = () => {
    setRows(savedRows);
    setRowKeys(savedRows.map(() => nextRowKey()));
  };

  const importCsvFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = parseSamplesheetCsv(text);
      if (parsed.length === 0) {
        onNotify(`No sample rows found in "${file.name}".`, "warning");
        return;
      }
      setRows(parsed);
      setRowKeys(parsed.map(() => nextRowKey()));
      onNotify(
        `Loaded ${parsed.length} sample(s) from ${file.name}. Click "Save Samplesheet" to save.`,
        "success"
      );
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Failed to read dropped CSV file",
        "error"
      );
    }
  };

  const handleDropCsv = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      void importCsvFile(file);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      void importCsvFile(file);
    }
    e.target.value = "";
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.saveSamplesheet(rows);
      setSavedRows(rows);
      onNotify(`Saved ${res.count} row(s) to config/samplesheet.csv`, "success");
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Failed to save samplesheet.csv",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={84} />
        <Skeleton variant="rounded" height={420} />
      </Stack>
    );
  }

  return (
    <Stack spacing={3}>
      <PageHeader
        title="Samplesheet Management"
        badges={
          <>
            <Chip
              label={`${rows.length} sample${rows.length === 1 ? "" : "s"}`}
              size="small"
              color="primary"
              variant="outlined"
            />
            <Chip
              label={isDirty ? "Unsaved Changes" : "Saved"}
              color={isDirty ? "warning" : "success"}
              size="small"
              variant={isDirty ? "filled" : "outlined"}
            />
          </>
        }
        subtitle={
          <>
            Editing <code>{projectPath}/config/samplesheet.csv</code>
          </>
        }
        actions={
          <>
            <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddRow}>
              Add Sample
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RestoreIcon />}
              disabled={!isDirty || saving}
              onClick={handleDiscard}
            >
              Discard
            </Button>
            <Button
              variant="contained"
              startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
              disabled={saving}
              onClick={() => void handleSave()}
            >
              {saving ? "Saving..." : "Save Samplesheet"}
            </Button>
          </>
        }
      />

      {validationWarnings.length > 0 && (
        <Alert severity="warning">
          <Typography variant="subtitle2" gutterBottom>
            Samplesheet Validation Notices ({validationWarnings.length})
          </Typography>
          <List dense disablePadding>
            {validationWarnings.map((w, idx) => (
              <ListItem key={idx} disableGutters sx={{ py: 0 }}>
                <ListItemText
                  primary={w}
                  primaryTypographyProps={{ variant: "caption" }}
                />
              </ListItem>
            ))}
          </List>
        </Alert>
      )}

      <Card>
        {rows.length > 0 && (
          <>
            <Box sx={{ px: 2, py: 1.5, bgcolor: "background.default" }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                flexWrap="wrap"
                gap={1.5}
              >
                <TextField
                  placeholder="Filter samples by ID, name, condition, target..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  sx={{ width: { xs: "100%", sm: 360 }, bgcolor: "background.paper" }}
                  slotProps={{
                    input: {
                      startAdornment: (
                        <InputAdornment position="start">
                          <SearchIcon fontSize="small" color="action" />
                        </InputAdornment>
                      ),
                      endAdornment: searchFilter ? (
                        <InputAdornment position="end">
                          <IconButton
                            size="small"
                            aria-label="Clear sample filter"
                            onClick={() => setSearchFilter("")}
                          >
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ) : undefined,
                    },
                  }}
                />
                <Typography variant="caption" color="text.secondary">
                  Showing {indexedFilteredRows.length} of {rows.length} row(s)
                </Typography>
              </Stack>
            </Box>
            <Divider />
          </>
        )}

        <CardContent sx={{ p: 0 }}>
          {rows.length === 0 ? (
            <Box sx={{ p: 3 }}>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                hidden
                onChange={handleFileInputChange}
              />
              <Paper
                variant="outlined"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragOver(false);
                }}
                onDrop={handleDropCsv}
                onClick={() => fileInputRef.current?.click()}
                sx={(theme) => ({
                  py: 6,
                  px: 3,
                  textAlign: "center",
                  cursor: "pointer",
                  border: "2px dashed",
                  borderColor: isDragOver ? "primary.main" : "divider",
                  bgcolor: isDragOver
                    ? alpha(theme.palette.primary.main, 0.06)
                    : "background.default",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    borderColor: "primary.main",
                    bgcolor: alpha(theme.palette.primary.main, 0.03),
                  },
                })}
              >
                <Stack spacing={1.25} alignItems="center" justifyContent="center">
                  <UploadFileOutlinedIcon
                    fontSize="large"
                    color={isDragOver ? "primary" : "action"}
                  />
                  <Typography variant="body1" sx={{ fontWeight: 600 }}>
                    No samples in <code>samplesheet.csv</code> yet
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 500 }}>
                    Drag and drop a <code>samplesheet.csv</code> file here (or click to browse), or
                    use &ldquo;+ Add Sample&rdquo; above.
                  </Typography>
                </Stack>
              </Paper>
            </Box>
          ) : (
            <TableContainer sx={{ maxHeight: "calc(100vh - 320px)", minHeight: 300 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>Sample ID (BAM stem)</TableCell>
                    <TableCell>Sample Name</TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell width={160}>Peak Mode</TableCell>
                    <TableCell width={100}>Replicate</TableCell>
                    <TableCell width={220}>Control ID (IgG)</TableCell>
                    <TableCell align="right" width={96}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {indexedFilteredRows.map(({ row, index, rowKey }) => {
                    const err = rowErrors[index];
                    return (
                      <TableRow key={rowKey} hover>
                        <TableCell>
                          <Tooltip title={err?.sampleIdError ?? ""} arrow>
                            <TextField
                              variant="standard"
                              fullWidth
                              error={Boolean(err?.sampleIdError)}
                              value={row.sample_id}
                              onChange={(e) =>
                                handleUpdateRow(index, "sample_id", e.target.value)
                              }
                              placeholder="L9254-0001_S141_L004"
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            value={row.sample_name}
                            onChange={(e) =>
                              handleUpdateRow(index, "sample_name", e.target.value)
                            }
                            placeholder="EV_INT_H3K4me3"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            value={row.condition}
                            onChange={(e) =>
                              handleUpdateRow(index, "condition", e.target.value)
                            }
                            placeholder="EV_INT_H3K4me3"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            value={row.target}
                            onChange={(e) =>
                              handleUpdateRow(index, "target", e.target.value)
                            }
                            placeholder="H3K4me3 / H3K27me3 / IgG"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            select
                            variant="standard"
                            fullWidth
                            value={row.peak_mode}
                            onChange={(e) =>
                              handleUpdateRow(index, "peak_mode", e.target.value)
                            }
                          >
                            <MenuItem value="narrow">narrow</MenuItem>
                            <MenuItem value="broad">broad</MenuItem>
                            <MenuItem value="">(Control / IgG)</MenuItem>
                          </TextField>
                        </TableCell>
                        <TableCell>
                          <TextField
                            variant="standard"
                            fullWidth
                            value={row.replicate}
                            onChange={(e) =>
                              handleUpdateRow(index, "replicate", e.target.value)
                            }
                          />
                        </TableCell>
                        <TableCell>
                          <Tooltip title={err?.controlIdError ?? ""} arrow>
                            <Autocomplete
                              freeSolo
                              options={iggSampleIds}
                              value={row.control_id}
                              onInputChange={(_, newValue) =>
                                handleUpdateRow(index, "control_id", newValue)
                              }
                              renderInput={(params) => (
                                <TextField
                                  {...params}
                                  variant="standard"
                                  error={Boolean(err?.controlIdError)}
                                  placeholder="Optional IgG sample_id"
                                />
                              )}
                            />
                          </Tooltip>
                        </TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Duplicate row">
                              <IconButton
                                size="small"
                                aria-label={`Duplicate sample row ${index + 1}`}
                                onClick={() => handleDuplicateRow(index)}
                              >
                                <ContentCopyIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Delete row">
                              <IconButton
                                size="small"
                                color="error"
                                aria-label={`Delete sample row ${index + 1}`}
                                onClick={() => handleDeleteRow(index)}
                              >
                                <DeleteOutlineIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </CardContent>
      </Card>
    </Stack>
  );
};
