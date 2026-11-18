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
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Switch,
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
import CodeIcon from "@mui/icons-material/Code";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import RestoreIcon from "@mui/icons-material/Restore";
import { api } from "../../api/client";
import type {
  ContrastItem,
  ExperimentConfig,
  SamplesheetRow,
} from "../../types/api";
import { DirectoryBrowserDialog } from "../../components/projects/DirectoryBrowserDialog";

export interface ConfigPageProps {
  projectPath: string;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
}

const STEP_TOGGLES: Array<{
  key: keyof ExperimentConfig;
  label: string;
  step: string;
  description: string;
}> = [
  {
    key: "run_macs2_callpeak",
    label: "MACS2 Peak Calling",
    step: "Step c",
    description: "Call narrow/broad peaks per sample using MACS2",
  },
  {
    key: "run_homer_findpeaks",
    label: "HOMER findPeaks",
    step: "Step c",
    description: "Call factor/histone peaks using HOMER tag directories",
  },
  {
    key: "use_igg_control",
    label: "Use IgG Negative Control",
    step: "Step c",
    description: "Pass matched control_id from samplesheet.csv to MACS2/HOMER",
  },
  {
    key: "run_merge_replicate_peaks",
    label: "Merge Replicate Peaks",
    step: "Step d",
    description: "Keep consensus peaks present in >= min_replicate_overlap replicates",
  },
  {
    key: "run_merge_master_peaks",
    label: "Merge Master Peaks",
    step: "Step d",
    description: "Create master union peak set across conditions per target",
  },
  {
    key: "run_homer_annotatepeaks",
    label: "HOMER annotatePeaks",
    step: "Step e",
    description: "Genomic feature annotation and tag quantification across peaks",
  },
  {
    key: "run_homer_diffpeaks",
    label: "HOMER Differential Peaks",
    step: "Step f",
    description: "Run getDifferentialPeaksReplicates for configured contrasts",
  },
  {
    key: "run_deeptools_metapeak",
    label: "deepTools Metapeak & Tornado",
    step: "Step g",
    description: "Generate computeMatrix and plotHeatmap signal profiles",
  },
  {
    key: "run_homer_findmotifs",
    label: "HOMER Motif Discovery",
    step: "Step h",
    description: "Run findMotifsGenome.pl on merged and differential peaks",
  },
  {
    key: "run_meme_streme",
    label: "MEME STREME Motifs",
    step: "Step h",
    description: "De novo motif discovery using MEME Suite STREME",
  },
  {
    key: "run_summary_plots",
    label: "Summary & Volcano QC Plots",
    step: "Step i",
    description: "Automated peak counts, annotation distributions, and volcano plots",
  },
];

export const ConfigPage: React.FC<ConfigPageProps> = ({ projectPath, onNotify }) => {
  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<ExperimentConfig | null>(null);
  const [rawText, setRawText] = useState<string>("");
  const [samples, setSamples] = useState<SamplesheetRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rawDialogOpen, setRawDialogOpen] = useState<boolean>(false);
  const [inputDirBrowserOpen, setInputDirBrowserOpen] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgRes, ssRes] = await Promise.all([
        api.getConfig(),
        api.getSamplesheet().catch(() => ({ rows: [] })),
      ]);
      setConfig(cfgRes.config);
      setSavedConfig(cfgRes.config);
      setRawText(cfgRes.raw);
      setSamples(ssRes.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load experiment.config");
      setConfig(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, [projectPath]);

  const isDirty = useMemo(() => {
    if (!config || !savedConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  const conditionOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of samples) {
      if (s.condition?.trim()) set.add(s.condition.trim());
    }
    return Array.from(set);
  }, [samples]);

  const targetOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of samples) {
      if (s.target?.trim() && s.target.trim().toLowerCase() !== "igg") {
        set.add(s.target.trim());
      }
    }
    return Array.from(set);
  }, [samples]);

  const updateField = <K extends keyof ExperimentConfig>(
    key: K,
    value: ExperimentConfig[K]
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await api.saveConfig(config);
      setConfig(res.config);
      setSavedConfig(res.config);
      setRawText(res.raw);
      onNotify("Saved config/experiment.config", "success");
    } catch (err) {
      onNotify(err instanceof Error ? err.message : "Failed to save configuration", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAddContrast = () => {
    if (!config) return;
    const defaultTarget = targetOptions[0] ?? "H3K4me3";
    const defaultTreatment = conditionOptions[0] ?? "";
    const defaultBackground = conditionOptions[1] ?? conditionOptions[0] ?? "";
    const nextItem: ContrastItem = {
      id: `Contrast_${config.diff_contrasts.length + 1}`,
      treatment: defaultTreatment,
      background: defaultBackground,
      target: defaultTarget,
    };
    updateField("diff_contrasts", [...config.diff_contrasts, nextItem]);
  };

  const handleUpdateContrast = (
    idx: number,
    field: keyof ContrastItem,
    value: string
  ) => {
    if (!config) return;
    const updated = config.diff_contrasts.map((item, i) => {
      if (i !== idx) return item;
      const next = { ...item, [field]: value };
      // Auto-suggest ID if user changes treatment/background and ID is still generic
      if (
        (field === "treatment" || field === "background") &&
        (item.id.startsWith("Contrast_") || !item.id.trim()) &&
        next.treatment &&
        next.background
      ) {
        next.id = `${next.treatment}_vs_${next.background}`;
      }
      return next;
    });
    updateField("diff_contrasts", updated);
  };

  const handleRemoveContrast = (idx: number) => {
    if (!config) return;
    updateField(
      "diff_contrasts",
      config.diff_contrasts.filter((_, i) => i !== idx)
    );
  };

  if (loading) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ py: 8 }}>
        <CircularProgress />
      </Stack>
    );
  }

  if (error || !config) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        {error ?? "experiment.config could not be loaded for this project."}
      </Alert>
    );
  }

  return (
    <Box component="form" onSubmit={handleSave}>
      <Stack spacing={3}>
        {/* Sticky Action Header */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            position: "sticky",
            top: 72,
            zIndex: 10,
            bgcolor: "background.paper",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Typography variant="h6">Experiment Configuration</Typography>
              <Chip
                label={isDirty ? "Unsaved Changes" : "Saved"}
                color={isDirty ? "warning" : "success"}
                size="small"
                variant={isDirty ? "filled" : "outlined"}
              />
            </Stack>
            <Typography variant="caption" color="text.secondary">
              Editing <code>{projectPath}/config/experiment.config</code>
            </Typography>
          </Box>
          <Stack direction="row" spacing={1.5}>
            <Button
              variant="outlined"
              startIcon={<CodeIcon />}
              onClick={() => setRawDialogOpen(true)}
            >
              View Groovy File
            </Button>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<RestoreIcon />}
              disabled={!isDirty || saving}
              onClick={() => setConfig(savedConfig)}
            >
              Discard
            </Button>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Configuration"}
            </Button>
          </Stack>
        </Paper>

        {/* 1. Experiment Identity & Paths */}
        <Card variant="outlined">
          <CardHeader
            title="1. Experiment Identity & Paths"
            subheader="Core experiment metadata, upstream alignment/tag directory input, and output paths"
          />
          <Divider />
          <CardContent>
            <Grid container spacing={2.5}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Experiment Name (params.experiment)"
                  size="small"
                  required
                  fullWidth
                  value={config.experiment}
                  onChange={(e) => updateField("experiment", e.target.value)}
                  helperText="Used to namespace results/<experiment>"
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  label="Notification Email (params.email)"
                  size="small"
                  fullWidth
                  value={config.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  helperText="Passed to Nextflow -N flag on completion"
                />
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Upstream Input Directory (params.input_dir)"
                    size="small"
                    fullWidth
                    value={config.input_dir}
                    onChange={(e) => updateField("input_dir", e.target.value)}
                    helperText="Folder containing 06_index_bam/, 07_homer/, and bigWig subfolders"
                  />
                  <Button
                    variant="outlined"
                    startIcon={<FolderOpenIcon />}
                    onClick={() => setInputDirBrowserOpen(true)}
                    sx={{ whiteSpace: "nowrap", height: 40 }}
                  >
                    Browse
                  </Button>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  label="Active BigWig Subdirectory (active_bigwig_dir)"
                  size="small"
                  fullWidth
                  value={config.active_bigwig_dir}
                  onChange={(e) => {
                    const val = e.target.value;
                    updateField("active_bigwig_dir", val);
                    updateField(
                      "bigwig_source",
                      val.toLowerCase().includes("deeptools") ? "deepTools" : "UCSC"
                    );
                  }}
                >
                  <MenuItem value="07_homer/ucsc_bw">07_homer/ucsc_bw (HOMER UCSC BigWig)</MenuItem>
                  <MenuItem value="08_deeptools/bw">08_deeptools/bw (deepTools BigWig)</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Output Directory (params.outdir)"
                  size="small"
                  fullWidth
                  value={config.outdir}
                  onChange={(e) => updateField("outdir", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  label="Samplesheet Path (params.samplesheet)"
                  size="small"
                  fullWidth
                  value={config.samplesheet}
                  onChange={(e) => updateField("samplesheet", e.target.value)}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* 2. Step Toggles */}
        <Card variant="outlined">
          <CardHeader
            title="2. Pipeline Step Toggles"
            subheader="Enable or skip individual downstream analysis modules"
          />
          <Divider />
          <CardContent>
            <Grid container spacing={2}>
              {STEP_TOGGLES.map((item) => {
                const checked = Boolean(config[item.key]);
                return (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.key}>
                    <Paper
                      variant="outlined"
                      sx={{
                        p: 1.5,
                        height: "100%",
                        bgcolor: checked ? "primary.light" : "background.paper",
                        borderColor: checked ? "primary.main" : "divider",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
                        <Box sx={{ pr: 1 }}>
                          <Stack direction="row" spacing={1} alignItems="center">
                            <Chip label={item.step} size="small" color="primary" />
                            <Typography variant="subtitle2">{item.label}</Typography>
                          </Stack>
                          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
                            {item.description}
                          </Typography>
                        </Box>
                        <Switch
                          checked={checked}
                          onChange={(e) => updateField(item.key, e.target.checked as never)}
                        />
                      </Stack>
                    </Paper>
                  </Grid>
                );
              })}
            </Grid>
          </CardContent>
        </Card>

        {/* 3. Differential Contrasts */}
        <Card variant="outlined">
          <CardHeader
            title="3. Differential Peak Contrasts (params.diff_contrasts)"
            subheader="Define treatment vs. background comparisons for HOMER getDifferentialPeaksReplicates"
            action={
              <Button
                variant="outlined"
                size="small"
                startIcon={<AddIcon />}
                onClick={handleAddContrast}
              >
                Add Contrast
              </Button>
            }
          />
          <Divider />
          <CardContent>
            {config.diff_contrasts.length === 0 ? (
              <Alert severity="info">
                No differential contrasts configured. Click &ldquo;Add Contrast&rdquo; to add a treatment vs.
                background comparison.
              </Alert>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Contrast ID</TableCell>
                      <TableCell>Treatment Condition</TableCell>
                      <TableCell>Background Condition</TableCell>
                      <TableCell>Target Antibody/Mark</TableCell>
                      <TableCell align="right" width={72}>
                        Remove
                      </TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {config.diff_contrasts.map((c, idx) => (
                      <TableRow key={idx}>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={c.id}
                            onChange={(e) => handleUpdateContrast(idx, "id", e.target.value)}
                            placeholder="EV_INT_vs_N2_H3K4me3"
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={c.treatment}
                            onChange={(e) => handleUpdateContrast(idx, "treatment", e.target.value)}
                            placeholder="EV_INT_H3K4me3"
                            slotProps={{
                              htmlInput: { list: "config-conditions-datalist" },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={c.background}
                            onChange={(e) =>
                              handleUpdateContrast(idx, "background", e.target.value)
                            }
                            placeholder="N2_H3K4me3"
                            slotProps={{
                              htmlInput: { list: "config-conditions-datalist" },
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <TextField
                            size="small"
                            fullWidth
                            value={c.target}
                            onChange={(e) => handleUpdateContrast(idx, "target", e.target.value)}
                            placeholder="H3K4me3"
                            slotProps={{
                              htmlInput: { list: "config-targets-datalist" },
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Tooltip title="Remove contrast">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleRemoveContrast(idx)}
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
            <datalist id="config-conditions-datalist">
              {conditionOptions.map((cond) => (
                <option key={cond} value={cond} />
              ))}
            </datalist>
            <datalist id="config-targets-datalist">
              {targetOptions.map((tgt) => (
                <option key={tgt} value={tgt} />
              ))}
            </datalist>
          </CardContent>
        </Card>

        {/* 4. Peak Calling Parameters (MACS2 & HOMER) */}
        <Card variant="outlined">
          <CardHeader
            title="4. Peak Calling & Merging Parameters (MACS2 & HOMER)"
            subheader="Parameters dispatched per sample via peak_mode ('narrow' vs 'broad') from samplesheet.csv"
          />
          <Divider />
          <CardContent>
            <Stack spacing={3}>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="Active Peak Caller for Merging (Step d)"
                    size="small"
                    fullWidth
                    value={config.active_peak_caller}
                    onChange={(e) =>
                      updateField("active_peak_caller", e.target.value as "macs2" | "homer")
                    }
                  >
                    <MenuItem value="macs2">macs2</MenuItem>
                    <MenuItem value="homer">homer</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Min Replicate Overlap (min_replicate_overlap)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.min_replicate_overlap}
                    onChange={(e) =>
                      updateField("min_replicate_overlap", Number(e.target.value) || 1)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    select
                    label="MACS2 Control Scaling (macs2_scale_to)"
                    size="small"
                    fullWidth
                    value={config.macs2_scale_to ?? ""}
                    onChange={(e) =>
                      updateField(
                        "macs2_scale_to",
                        (e.target.value || null) as "small" | "large" | null
                      )
                    }
                  >
                    <MenuItem value="">null (Default MACS2 behavior)</MenuItem>
                    <MenuItem value="small">small</MenuItem>
                    <MenuItem value="large">large</MenuItem>
                  </TextField>
                </Grid>
              </Grid>

              <Divider />
              <Typography variant="subtitle2" color="primary">
                MACS2 Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Genome Size (macs2_gsize)"
                    size="small"
                    fullWidth
                    value={config.macs2_gsize}
                    onChange={(e) => updateField("macs2_gsize", e.target.value)}
                    helperText="ce, mm, hs, dm, or numeric"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    select
                    label="Format (macs2_format)"
                    size="small"
                    fullWidth
                    value={config.macs2_format}
                    onChange={(e) =>
                      updateField("macs2_format", e.target.value as "BAMPE" | "BAM" | "BED")
                    }
                  >
                    <MenuItem value="BAMPE">BAMPE (Paired-End)</MenuItem>
                    <MenuItem value="BAM">BAM (Single-End)</MenuItem>
                    <MenuItem value="BED">BED</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Extension Size (macs2_extsize)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.macs2_extsize}
                    onChange={(e) => updateField("macs2_extsize", Number(e.target.value) || 147)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={config.macs2_nomodel}
                        onChange={(e) => updateField("macs2_nomodel", e.target.checked)}
                      />
                    }
                    label="macs2_nomodel"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Narrow p-value (macs2_narrow_pvalue)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.macs2_narrow_pvalue ?? ""}
                    onChange={(e) =>
                      updateField(
                        "macs2_narrow_pvalue",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                    helperText="Blank uses q-value fallback"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Narrow q-value (macs2_narrow_qvalue)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.macs2_narrow_qvalue}
                    onChange={(e) =>
                      updateField("macs2_narrow_qvalue", Number(e.target.value) || 0.01)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Broad Seed q-value (macs2_broad_qvalue)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.macs2_broad_qvalue}
                    onChange={(e) =>
                      updateField("macs2_broad_qvalue", Number(e.target.value) || 0.01)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Broad Cutoff (macs2_broad_cutoff)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.macs2_broad_cutoff}
                    onChange={(e) =>
                      updateField("macs2_broad_cutoff", Number(e.target.value) || 0.05)
                    }
                  />
                </Grid>
              </Grid>

              <Divider />
              <Typography variant="subtitle2" color="primary">
                HOMER findPeaks &amp; annotatePeaks Settings
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    select
                    label="Narrow Style (homer_narrow_style)"
                    size="small"
                    fullWidth
                    value={config.homer_narrow_style}
                    onChange={(e) =>
                      updateField("homer_narrow_style", e.target.value as "factor" | "histone")
                    }
                  >
                    <MenuItem value="factor">factor</MenuItem>
                    <MenuItem value="histone">histone</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Narrow Fold -F (homer_narrow_fold)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.homer_narrow_fold}
                    onChange={(e) =>
                      updateField("homer_narrow_fold", Number(e.target.value) || 2.0)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Narrow Local Fold -L (homer_narrow_local_fold)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.homer_narrow_local_fold ?? ""}
                    onChange={(e) =>
                      updateField(
                        "homer_narrow_local_fold",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="annotatePeaks Size (annotatepeaks_size)"
                    size="small"
                    fullWidth
                    value={config.annotatepeaks_size}
                    onChange={(e) => updateField("annotatepeaks_size", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    select
                    label="Broad Style (homer_broad_style)"
                    size="small"
                    fullWidth
                    value={config.homer_broad_style}
                    onChange={(e) =>
                      updateField("homer_broad_style", e.target.value as "factor" | "histone")
                    }
                  >
                    <MenuItem value="histone">histone</MenuItem>
                    <MenuItem value="factor">factor</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Broad Fold -F (homer_broad_fold)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.homer_broad_fold}
                    onChange={(e) =>
                      updateField("homer_broad_fold", Number(e.target.value) || 1.5)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Broad Local Fold -L (homer_broad_local_fold)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.homer_broad_local_fold ?? ""}
                    onChange={(e) =>
                      updateField(
                        "homer_broad_local_fold",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Broad Min Dist -minDist (homer_broad_min_dist)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.homer_broad_min_dist ?? ""}
                    onChange={(e) =>
                      updateField(
                        "homer_broad_min_dist",
                        e.target.value === "" ? null : Number(e.target.value)
                      )
                    }
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>

        {/* 5. Metapeak, Motifs, Summary Plots & Resource Limits */}
        <Card variant="outlined">
          <CardHeader
            title="5. Downstream Plots, Motifs, Reference & Resource Limits"
            subheader="deepTools heatmaps, HOMER/MEME motif discovery, volcano thresholds, and Nextflow compute limits"
          />
          <Divider />
          <CardContent>
            <Stack spacing={3}>
              <Typography variant="subtitle2" color="primary">
                deepTools Metapeak &amp; Heatmap (Step g)
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Upstream bp (metapeak_upstream)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.metapeak_upstream}
                    onChange={(e) =>
                      updateField("metapeak_upstream", Number(e.target.value) || 2000)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Downstream bp (metapeak_downstream)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.metapeak_downstream}
                    onChange={(e) =>
                      updateField("metapeak_downstream", Number(e.target.value) || 2000)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <TextField
                    label="Reference Point"
                    size="small"
                    fullWidth
                    value={config.metapeak_reference_point}
                    onChange={(e) => updateField("metapeak_reference_point", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <TextField
                    label="Colormap"
                    size="small"
                    fullWidth
                    value={config.heatmap_colormap}
                    onChange={(e) => updateField("heatmap_colormap", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 2 }}>
                  <TextField
                    label="Interpolation"
                    size="small"
                    fullWidth
                    value={config.heatmap_interpolation}
                    onChange={(e) => updateField("heatmap_interpolation", e.target.value)}
                  />
                </Grid>
              </Grid>

              <Divider />
              <Typography variant="subtitle2" color="primary">
                Motif Discovery &amp; Volcano Plot Thresholds (Steps h &amp; i)
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="HOMER Motif Size"
                    size="small"
                    fullWidth
                    value={config.homer_motif_size}
                    onChange={(e) => updateField("homer_motif_size", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="MEME Slop Left (bp)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.meme_slop_left}
                    onChange={(e) => updateField("meme_slop_left", Number(e.target.value) || 0)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="MEME Slop Right (bp)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.meme_slop_right}
                    onChange={(e) => updateField("meme_slop_right", Number(e.target.value) || 0)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="STREME Max Motifs"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.meme_streme_nmotifs}
                    onChange={(e) =>
                      updateField("meme_streme_nmotifs", Number(e.target.value) || 20)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Volcano FDR Threshold"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.volcano_fdr_threshold}
                    onChange={(e) =>
                      updateField("volcano_fdr_threshold", Number(e.target.value) || 0.05)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Volcano Log2FC Threshold"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.volcano_log2fc_threshold}
                    onChange={(e) =>
                      updateField("volcano_log2fc_threshold", Number(e.target.value) || 1.0)
                    }
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 4 }}>
                  <TextField
                    label="Volcano Top N Labels"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.volcano_top_n_labels}
                    onChange={(e) =>
                      updateField("volcano_top_n_labels", Number(e.target.value) || 0)
                    }
                  />
                </Grid>
              </Grid>

              <Divider />
              <Typography variant="subtitle2" color="primary">
                Genome Reference &amp; Process Resource Limits
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Genome Name"
                    size="small"
                    fullWidth
                    value={config.genome_name}
                    onChange={(e) => updateField("genome_name", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Max CPUs (resourceLimits.cpus)"
                    type="number"
                    size="small"
                    fullWidth
                    value={config.resource_cpus}
                    onChange={(e) => updateField("resource_cpus", Number(e.target.value) || 8)}
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Max Memory (resourceLimits.memory)"
                    size="small"
                    fullWidth
                    value={config.resource_memory}
                    onChange={(e) => updateField("resource_memory", e.target.value)}
                    helperText="e.g. 128.GB, 32.GB"
                  />
                </Grid>
                <Grid size={{ xs: 12, sm: 3 }}>
                  <TextField
                    label="Max Walltime (resourceLimits.time)"
                    size="small"
                    fullWidth
                    value={config.resource_time}
                    onChange={(e) => updateField("resource_time", e.target.value)}
                    helperText="e.g. 72.h, 24.h"
                  />
                </Grid>
              </Grid>
            </Stack>
          </CardContent>
        </Card>
      </Stack>

      {/* Raw Groovy Config Viewer Modal */}
      <Dialog open={rawDialogOpen} onClose={() => setRawDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>experiment.config (Groovy Preview)</DialogTitle>
        <DialogContent dividers>
          <Box
            component="pre"
            sx={{
              m: 0,
              p: 2,
              bgcolor: "#0f172a",
              color: "#e2e8f0",
              borderRadius: 1.5,
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.82rem",
              overflowX: "auto",
            }}
          >
            {rawText}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRawDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      <DirectoryBrowserDialog
        open={inputDirBrowserOpen}
        title="Select Upstream Input Directory (params.input_dir)"
        initialPath={config.input_dir}
        onClose={() => setInputDirBrowserOpen(false)}
        onSelect={(selected) => updateField("input_dir", selected)}
      />
    </Box>
  );
};
