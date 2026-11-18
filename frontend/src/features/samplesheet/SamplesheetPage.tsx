import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
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
import SaveIcon from "@mui/icons-material/Save";
import AddIcon from "@mui/icons-material/Add";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import TravelExploreIcon from "@mui/icons-material/TravelExplore";
import RestoreIcon from "@mui/icons-material/Restore";
import { api } from "../../api/client";
import type { SamplesheetRow } from "../../types/api";

export interface SamplesheetPageProps {
  projectPath: string;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

export const SamplesheetPage: React.FC<SamplesheetPageProps> = ({
  projectPath,
  onNotify,
}) => {
  const [rows, setRows] = useState<SamplesheetRow[]>([]);
  const [savedRows, setSavedRows] = useState<SamplesheetRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [discovering, setDiscovering] = useState<boolean>(false);

  const loadSamplesheet = async () => {
    setLoading(true);
    try {
      const res = await api.getSamplesheet();
      setRows(res.rows);
      setSavedRows(res.rows);
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

  const validationWarnings = useMemo(() => {
    const warnings: string[] = [];
    const seenIds = new Set<string>();
    const allIds = new Set(rows.map((r) => r.sample_id.trim()).filter(Boolean));

    rows.forEach((row, index) => {
      const sid = row.sample_id.trim();
      if (!sid) {
        warnings.push(`Row ${index + 1}: sample_id is empty.`);
      } else if (seenIds.has(sid)) {
        warnings.push(`Row ${index + 1}: duplicate sample_id "${sid}".`);
      } else {
        seenIds.add(sid);
      }

      if (row.control_id.trim() && !allIds.has(row.control_id.trim())) {
        warnings.push(
          `Row ${index + 1} (${sid || "unnamed"}): control_id "${row.control_id}" does not match any sample_id in the table.`
        );
      }
    });

    return warnings;
  }, [rows]);

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
    setRows((prev) => [
      ...prev.slice(0, index + 1),
      copy,
      ...prev.slice(index + 1),
    ]);
  };

  const handleDeleteRow = (index: number) => {
    setRows((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDiscoverBams = async () => {
    setDiscovering(true);
    try {
      const res = await api.discoverSamples();
      if (res.error) {
        onNotify(res.error, "warning");
        return;
      }
      const existingIds = new Set(rows.map((r) => r.sample_id.trim()));
      const newRows: SamplesheetRow[] = [];
      for (const bamStem of res.discovered) {
        if (!existingIds.has(bamStem)) {
          const isIgg = bamStem.toLowerCase().includes("igg");
          const isBroad = bamStem.toLowerCase().includes("k27me3");
          newRows.push({
            sample_id: bamStem,
            sample_name: bamStem,
            condition: bamStem,
            target: isIgg ? "IgG" : isBroad ? "H3K27me3" : "H3K4me3",
            peak_mode: isIgg ? "" : isBroad ? "broad" : "narrow",
            replicate: "1",
            control_id: "",
          });
        }
      }
      if (newRows.length === 0) {
        onNotify(
          `Scanned ${res.discovered.length} BAM file(s); all are already in the samplesheet.`,
          "info"
        );
      } else {
        setRows((prev) => [...prev, ...newRows]);
        onNotify(`Added ${newRows.length} discovered BAM sample(s).`, "success");
      }
    } catch (err) {
      onNotify(
        err instanceof Error ? err.message : "Failed to auto-discover BAMs",
        "error"
      );
    } finally {
      setDiscovering(false);
    }
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
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

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
            <Typography variant="h6">Samplesheet Management</Typography>
            <Chip label={`${rows.length} samples`} size="small" color="primary" variant="outlined" />
            <Chip
              label={isDirty ? "Unsaved Changes" : "Saved"}
              color={isDirty ? "warning" : "success"}
              size="small"
              variant={isDirty ? "filled" : "outlined"}
            />
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Editing <code>{projectPath}/config/samplesheet.csv</code>
          </Typography>
        </Box>
        <Stack direction="row" spacing={1.5}>
          <Button
            variant="outlined"
            startIcon={<TravelExploreIcon />}
            disabled={discovering}
            onClick={() => void handleDiscoverBams()}
          >
            {discovering ? "Scanning..." : "Auto-Scan BAMs"}
          </Button>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddRow}>
            Add Sample
          </Button>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<RestoreIcon />}
            disabled={!isDirty || saving}
            onClick={() => setRows(savedRows)}
          >
            Discard
          </Button>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            disabled={saving}
            onClick={() => void handleSave()}
          >
            {saving ? "Saving..." : "Save Samplesheet"}
          </Button>
        </Stack>
      </Paper>

      {validationWarnings.length > 0 && (
        <Alert severity="warning">
          <Typography variant="subtitle2" gutterBottom>
            Samplesheet Validation Notices
          </Typography>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {validationWarnings.map((w, idx) => (
              <li key={idx}>
                <Typography variant="caption">{w}</Typography>
              </li>
            ))}
          </Box>
        </Alert>
      )}

      <Card variant="outlined">
        <CardContent sx={{ p: 0 }}>
          {rows.length === 0 ? (
            <Box sx={{ p: 4, textAlign: "center" }}>
              <Typography variant="body1" gutterBottom>
                No samples in <code>samplesheet.csv</code> yet.
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Click &ldquo;Auto-Scan BAMs&rdquo; to populate samples from{" "}
                <code>06_index_bam/*.bam</code> or add rows manually.
              </Typography>
              <Button variant="contained" startIcon={<AddIcon />} onClick={handleAddRow}>
                Add First Sample
              </Button>
            </Box>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Sample ID (BAM stem)</TableCell>
                    <TableCell>Sample Name</TableCell>
                    <TableCell>Condition</TableCell>
                    <TableCell>Target</TableCell>
                    <TableCell width={160}>Peak Mode</TableCell>
                    <TableCell width={100}>Replicate</TableCell>
                    <TableCell>Control ID (IgG)</TableCell>
                    <TableCell align="right" width={96}>
                      Actions
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row, idx) => (
                    <TableRow key={idx} hover>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.sample_id}
                          onChange={(e) =>
                            handleUpdateRow(idx, "sample_id", e.target.value)
                          }
                          placeholder="L9254-0001_S141_L004"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.sample_name}
                          onChange={(e) =>
                            handleUpdateRow(idx, "sample_name", e.target.value)
                          }
                          placeholder="EV_INT_H3K4me3"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.condition}
                          onChange={(e) =>
                            handleUpdateRow(idx, "condition", e.target.value)
                          }
                          placeholder="EV_INT_H3K4me3"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.target}
                          onChange={(e) =>
                            handleUpdateRow(idx, "target", e.target.value)
                          }
                          placeholder="H3K4me3 / H3K27me3 / IgG"
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          select
                          size="small"
                          fullWidth
                          value={row.peak_mode}
                          onChange={(e) =>
                            handleUpdateRow(idx, "peak_mode", e.target.value)
                          }
                        >
                          <MenuItem value="narrow">narrow</MenuItem>
                          <MenuItem value="broad">broad</MenuItem>
                          <MenuItem value="">(Control / IgG)</MenuItem>
                        </TextField>
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.replicate}
                          onChange={(e) =>
                            handleUpdateRow(idx, "replicate", e.target.value)
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <TextField
                          size="small"
                          fullWidth
                          value={row.control_id}
                          onChange={(e) =>
                            handleUpdateRow(idx, "control_id", e.target.value)
                          }
                          placeholder="Optional IgG sample_id"
                          slotProps={{
                            htmlInput: { list: "igg-samples-datalist" },
                          }}
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                          <Tooltip title="Duplicate row">
                            <IconButton
                              size="small"
                              onClick={() => handleDuplicateRow(idx)}
                            >
                              <ContentCopyIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Delete row">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteRow(idx)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          <datalist id="igg-samples-datalist">
            {iggSampleIds.map((id) => (
              <option key={id} value={id} />
            ))}
          </datalist>
        </CardContent>
      </Card>
    </Stack>
  );
};
