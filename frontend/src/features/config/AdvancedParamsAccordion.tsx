import React, { useEffect, useState } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Button,
  Chip,
  Divider,
  FormControlLabel,
  Grid2 as Grid,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import UnfoldMoreIcon from "@mui/icons-material/UnfoldMore";
import UnfoldLessIcon from "@mui/icons-material/UnfoldLess";
import type { ExperimentConfig } from "../../types/api";

export function parseNumericInput(
  raw: string,
  fallback: number,
  allowNull = false
): number | null {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return allowNull ? null : fallback;
  }
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) {
    return allowNull ? null : fallback;
  }
  return parsed;
}

interface NumericFieldProps {
  label: string;
  value: number | null | undefined;
  fallback?: number;
  allowNull?: boolean;
  helperText?: string;
  unitAdornment?: string;
  onChange: (nextValue: number | null) => void;
}

const NumericField: React.FC<NumericFieldProps> = ({
  label,
  value,
  fallback = 0,
  allowNull = false,
  helperText,
  unitAdornment,
  onChange,
}) => {
  const [draft, setDraft] = useState<string>(value === null || value === undefined ? "" : String(value));

  useEffect(() => {
    setDraft(value === null || value === undefined ? "" : String(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const nextRaw = e.target.value;
    setDraft(nextRaw);
    if (nextRaw.trim() === "") {
      if (allowNull) onChange(null);
      return;
    }
    const parsed = Number(nextRaw);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
  };

  const handleBlur = () => {
    const committed = parseNumericInput(draft, fallback, allowNull);
    onChange(committed);
    setDraft(committed === null ? "" : String(committed));
  };

  return (
    <TextField
      label={label}
      type="number"
      fullWidth
      value={draft}
      onChange={handleChange}
      onBlur={handleBlur}
      helperText={helperText}
      slotProps={
        unitAdornment
          ? {
              input: {
                endAdornment: <InputAdornment position="end">{unitAdornment}</InputAdornment>,
              },
            }
          : undefined
      }
    />
  );
};

export interface AdvancedParamsAccordionProps {
  config: ExperimentConfig;
  onUpdateField: <K extends keyof ExperimentConfig>(key: K, value: ExperimentConfig[K]) => void;
}

export const AdvancedParamsAccordion: React.FC<AdvancedParamsAccordionProps> = ({
  config,
  onUpdateField,
}) => {
  const [peakExpanded, setPeakExpanded] = useState<boolean>(false);
  const [downstreamExpanded, setDownstreamExpanded] = useState<boolean>(false);
  const [resourcesExpanded, setResourcesExpanded] = useState<boolean>(false);

  const allExpanded = peakExpanded && downstreamExpanded && resourcesExpanded;

  const handleToggleAll = () => {
    const next = !allExpanded;
    setPeakExpanded(next);
    setDownstreamExpanded(next);
    setResourcesExpanded(next);
  };

  return (
    <Stack spacing={1.5}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography variant="subtitle2" color="text.secondary">
          Advanced Pipeline Parameters (Progressive Disclosure)
        </Typography>
        <Button
          size="small"
          color="inherit"
          startIcon={allExpanded ? <UnfoldLessIcon fontSize="small" /> : <UnfoldMoreIcon fontSize="small" />}
          onClick={handleToggleAll}
        >
          {allExpanded ? "Collapse Advanced Sections" : "Expand Advanced Sections"}
        </Button>
      </Stack>

      {/* Section 4: Peak Calling & Merging Parameters */}
      <Accordion
        expanded={peakExpanded}
        onChange={(_, isExp) => setPeakExpanded(isExp)}
        variant="outlined"
        disableGutters
        sx={{ borderRadius: 2, "&:before": { display: "none" } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 0.75 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1.5}
            sx={{ width: "100%", pr: 1 }}
          >
            <Box>
              <Typography variant="h6">
                4. Peak Calling &amp; Merging Parameters (MACS2 &amp; HOMER)
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Parameters dispatched per sample via <code>peak_mode</code> (&lsquo;narrow&rsquo; vs
                &lsquo;broad&rsquo;) from <code>samplesheet.csv</code>
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                label={`Caller: ${config.active_peak_caller}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Format: ${config.macs2_format}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`Min Overlap: ${config.min_replicate_overlap}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Stack spacing={3}>
            <Grid container spacing={2} alignItems="center">
              <Grid size={{ xs: 12, sm: 4 }}>
                <Stack spacing={0.5}>
                  <Typography variant="caption" color="text.secondary">
                    Active Peak Caller for Merging (Step b)
                  </Typography>
                  <ToggleButtonGroup
                    size="small"
                    exclusive
                    color="primary"
                    fullWidth
                    value={config.active_peak_caller}
                    onChange={(_, val: "macs2" | "homer" | null) => {
                      if (val) onUpdateField("active_peak_caller", val);
                    }}
                    aria-label="Active Peak Caller for Merging"
                  >
                    <ToggleButton value="macs2">MACS2</ToggleButton>
                    <ToggleButton value="homer">HOMER</ToggleButton>
                  </ToggleButtonGroup>
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <NumericField
                  label="Min Replicate Overlap (min_replicate_overlap)"
                  value={config.min_replicate_overlap}
                  fallback={1}
                  onChange={(v) => onUpdateField("min_replicate_overlap", v ?? 1)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <TextField
                  select
                  label="MACS2 Control Scaling (macs2_scale_to)"
                  fullWidth
                  value={config.macs2_scale_to ?? ""}
                  onChange={(e) =>
                    onUpdateField(
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
                  fullWidth
                  value={config.macs2_gsize}
                  onChange={(e) => onUpdateField("macs2_gsize", e.target.value)}
                  helperText="ce, mm, hs, dm, or numeric"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  select
                  label="Format (macs2_format)"
                  fullWidth
                  value={config.macs2_format}
                  onChange={(e) =>
                    onUpdateField("macs2_format", e.target.value as "BAMPE" | "BAM" | "BED")
                  }
                >
                  <MenuItem value="BAMPE">BAMPE (Paired-End)</MenuItem>
                  <MenuItem value="BAM">BAM (Single-End)</MenuItem>
                  <MenuItem value="BED">BED</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Extension Size (macs2_extsize)"
                  value={config.macs2_extsize}
                  fallback={147}
                  unitAdornment="bp"
                  onChange={(v) => onUpdateField("macs2_extsize", v ?? 147)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={config.macs2_nomodel}
                      onChange={(e) => onUpdateField("macs2_nomodel", e.target.checked)}
                    />
                  }
                  label="macs2_nomodel"
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Narrow p-value (macs2_narrow_pvalue)"
                  value={config.macs2_narrow_pvalue}
                  allowNull
                  helperText="Blank uses q-value fallback"
                  onChange={(v) => onUpdateField("macs2_narrow_pvalue", v)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Narrow q-value (macs2_narrow_qvalue)"
                  value={config.macs2_narrow_qvalue}
                  fallback={0.01}
                  onChange={(v) => onUpdateField("macs2_narrow_qvalue", v ?? 0.01)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Broad Seed q-value (macs2_broad_qvalue)"
                  value={config.macs2_broad_qvalue}
                  fallback={0.01}
                  onChange={(v) => onUpdateField("macs2_broad_qvalue", v ?? 0.01)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Broad Cutoff (macs2_broad_cutoff)"
                  value={config.macs2_broad_cutoff}
                  fallback={0.05}
                  onChange={(v) => onUpdateField("macs2_broad_cutoff", v ?? 0.05)}
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
                  fullWidth
                  value={config.homer_narrow_style}
                  onChange={(e) =>
                    onUpdateField("homer_narrow_style", e.target.value as "factor" | "histone")
                  }
                >
                  <MenuItem value="factor">factor</MenuItem>
                  <MenuItem value="histone">histone</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Narrow Fold -F (homer_narrow_fold)"
                  value={config.homer_narrow_fold}
                  fallback={2.0}
                  onChange={(v) => onUpdateField("homer_narrow_fold", v ?? 2.0)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Narrow Local Fold -L (homer_narrow_local_fold)"
                  value={config.homer_narrow_local_fold}
                  allowNull
                  onChange={(v) => onUpdateField("homer_narrow_local_fold", v)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  label="annotatePeaks Size (annotatepeaks_size)"
                  fullWidth
                  value={config.annotatepeaks_size}
                  onChange={(e) => onUpdateField("annotatepeaks_size", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  select
                  label="Broad Style (homer_broad_style)"
                  fullWidth
                  value={config.homer_broad_style}
                  onChange={(e) =>
                    onUpdateField("homer_broad_style", e.target.value as "factor" | "histone")
                  }
                >
                  <MenuItem value="histone">histone</MenuItem>
                  <MenuItem value="factor">factor</MenuItem>
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Broad Fold -F (homer_broad_fold)"
                  value={config.homer_broad_fold}
                  fallback={1.5}
                  onChange={(v) => onUpdateField("homer_broad_fold", v ?? 1.5)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Broad Local Fold -L (homer_broad_local_fold)"
                  value={config.homer_broad_local_fold}
                  allowNull
                  onChange={(v) => onUpdateField("homer_broad_local_fold", v)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Broad Min Dist -minDist (homer_broad_min_dist)"
                  value={config.homer_broad_min_dist}
                  allowNull
                  unitAdornment="bp"
                  onChange={(v) => onUpdateField("homer_broad_min_dist", v)}
                />
              </Grid>
            </Grid>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 5: Downstream Plots & Motif Discovery */}
      <Accordion
        expanded={downstreamExpanded}
        onChange={(_, isExp) => setDownstreamExpanded(isExp)}
        variant="outlined"
        disableGutters
        sx={{ borderRadius: 2, "&:before": { display: "none" } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 0.75 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1.5}
            sx={{ width: "100%", pr: 1 }}
          >
            <Box>
              <Typography variant="h6">
                5. Downstream Plots &amp; Motif Discovery
              </Typography>
              <Typography variant="caption" color="text.secondary">
                deepTools heatmaps, HOMER/MEME motif discovery, and volcano plot thresholds
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                label={`Window: -${config.metapeak_upstream}/+${config.metapeak_downstream}bp`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Colormap: ${config.heatmap_colormap}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`FDR: ${config.volcano_fdr_threshold}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Stack spacing={3}>
            <Typography variant="subtitle2" color="primary">
              deepTools Metapeak &amp; Heatmap (Step d)
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Upstream (metapeak_upstream)"
                  value={config.metapeak_upstream}
                  fallback={2000}
                  unitAdornment="bp"
                  onChange={(v) => onUpdateField("metapeak_upstream", v ?? 2000)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="Downstream (metapeak_downstream)"
                  value={config.metapeak_downstream}
                  fallback={2000}
                  unitAdornment="bp"
                  onChange={(v) => onUpdateField("metapeak_downstream", v ?? 2000)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 2 }}>
                <TextField
                  label="Reference Point"
                  fullWidth
                  value={config.metapeak_reference_point}
                  onChange={(e) => onUpdateField("metapeak_reference_point", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 2 }}>
                <TextField
                  label="Colormap"
                  fullWidth
                  value={config.heatmap_colormap}
                  onChange={(e) => onUpdateField("heatmap_colormap", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 2 }}>
                <TextField
                  label="Interpolation"
                  fullWidth
                  value={config.heatmap_interpolation}
                  onChange={(e) => onUpdateField("heatmap_interpolation", e.target.value)}
                />
              </Grid>
            </Grid>

            <Divider />
            <Typography variant="subtitle2" color="primary">
              Motif Discovery &amp; Volcano Plot Thresholds (Step d)
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 3 }}>
                <TextField
                  label="HOMER Motif Size"
                  fullWidth
                  value={config.homer_motif_size}
                  onChange={(e) => onUpdateField("homer_motif_size", e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="MEME Slop Left"
                  value={config.meme_slop_left}
                  fallback={0}
                  unitAdornment="bp"
                  onChange={(v) => onUpdateField("meme_slop_left", v ?? 0)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="MEME Slop Right"
                  value={config.meme_slop_right}
                  fallback={0}
                  unitAdornment="bp"
                  onChange={(v) => onUpdateField("meme_slop_right", v ?? 0)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 3 }}>
                <NumericField
                  label="STREME Max Motifs"
                  value={config.meme_streme_nmotifs}
                  fallback={20}
                  onChange={(v) => onUpdateField("meme_streme_nmotifs", v ?? 20)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <NumericField
                  label="Volcano FDR Threshold"
                  value={config.volcano_fdr_threshold}
                  fallback={0.05}
                  onChange={(v) => onUpdateField("volcano_fdr_threshold", v ?? 0.05)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <NumericField
                  label="Volcano Log2FC Threshold"
                  value={config.volcano_log2fc_threshold}
                  fallback={1.0}
                  onChange={(v) => onUpdateField("volcano_log2fc_threshold", v ?? 1.0)}
                />
              </Grid>
              <Grid size={{ xs: 12, sm: 4 }}>
                <NumericField
                  label="Volcano Top N Labels"
                  value={config.volcano_top_n_labels}
                  fallback={0}
                  onChange={(v) => onUpdateField("volcano_top_n_labels", v ?? 0)}
                />
              </Grid>
            </Grid>
          </Stack>
        </AccordionDetails>
      </Accordion>

      {/* Section 6: Process Resource Limits */}
      <Accordion
        expanded={resourcesExpanded}
        onChange={(_, isExp) => setResourcesExpanded(isExp)}
        variant="outlined"
        disableGutters
        sx={{ borderRadius: 2, "&:before": { display: "none" } }}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: 2.5, py: 0.75 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="center"
            flexWrap="wrap"
            gap={1.5}
            sx={{ width: "100%", pr: 1 }}
          >
            <Box>
              <Typography variant="h6">6. Process Resource Limits</Typography>
              <Typography variant="caption" color="text.secondary">
                Nextflow per-process CPU, memory, and walltime upper bounds (
                <code>process.resourceLimits</code>)
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip
                label={`CPUs: ${config.resource_cpus}`}
                size="small"
                color="primary"
                variant="outlined"
              />
              <Chip
                label={`Memory: ${config.resource_memory}`}
                size="small"
                variant="outlined"
              />
              <Chip
                label={`Walltime: ${config.resource_time}`}
                size="small"
                variant="outlined"
              />
            </Stack>
          </Stack>
        </AccordionSummary>
        <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
          <Divider sx={{ mb: 2.5 }} />
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <NumericField
                label="Max CPUs (resourceLimits.cpus)"
                value={config.resource_cpus}
                fallback={8}
                onChange={(v) => onUpdateField("resource_cpus", v ?? 8)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Max Memory (resourceLimits.memory)"
                fullWidth
                value={config.resource_memory}
                onChange={(e) => onUpdateField("resource_memory", e.target.value)}
                helperText="e.g. 128.GB, 32.GB"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <TextField
                label="Max Walltime (resourceLimits.time)"
                fullWidth
                value={config.resource_time}
                onChange={(e) => onUpdateField("resource_time", e.target.value)}
                helperText="e.g. 72.h, 24.h"
              />
            </Grid>
          </Grid>
        </AccordionDetails>
      </Accordion>
    </Stack>
  );
};
