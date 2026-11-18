import React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  FormControl,
  FormHelperText,
  Grid2 as Grid,
  InputAdornment,
  InputLabel,
  MenuItem,
  OutlinedInput,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import FolderOpenIcon from "@mui/icons-material/FolderOpen";
import type { ExperimentConfig } from "../../types/api";

export const DEFAULT_BIGWIG_TOOLS: Record<string, string> = {
  HOMER: "07_homer/ucsc_bw",
  deepTools: "08_deeptools/bw",
};

export function resolveBigwigToolName(
  activeBigwigDir: string,
  bigwigSource: "deepTools" | "UCSC",
  toolsMap: Record<string, string> = DEFAULT_BIGWIG_TOOLS
): string {
  for (const [toolName, dirPath] of Object.entries(toolsMap)) {
    if (dirPath === activeBigwigDir || toolName === activeBigwigDir) {
      return toolName;
    }
  }
  if (bigwigSource === "deepTools" || activeBigwigDir.toLowerCase().includes("deeptools")) {
    return "deepTools";
  }
  return "HOMER";
}

export interface IdentityPathsCardProps {
  config: ExperimentConfig;
  bigwigTools?: Record<string, string>;
  onUpdateField: <K extends keyof ExperimentConfig>(key: K, value: ExperimentConfig[K]) => void;
  onOpenInputDirBrowser: () => void;
}

export const IdentityPathsCard: React.FC<IdentityPathsCardProps> = ({
  config,
  bigwigTools = DEFAULT_BIGWIG_TOOLS,
  onUpdateField,
  onOpenInputDirBrowser,
}) => {
  const toolOptions = Object.keys(bigwigTools);
  const selectedTool = resolveBigwigToolName(
    config.active_bigwig_dir,
    config.bigwig_source,
    bigwigTools
  );

  return (
    <Card>
      <CardHeader
        title="1. Experiment Identity & Metadata"
        subheader="Core experiment metadata, control settings, and upstream alignment/tag directory input"
      />
      <Divider />
      <CardContent>
        <Grid container spacing={2.5} alignItems="flex-start">
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Experiment Name (params.experiment)"
              required
              fullWidth
              value={config.experiment}
              onChange={(e) => onUpdateField("experiment", e.target.value)}
              helperText="Used to namespace results/<experiment>"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              label="Notification Email (params.email)"
              fullWidth
              value={config.email}
              onChange={(e) => onUpdateField("email", e.target.value)}
              helperText="Passed to Nextflow -N flag on completion"
            />
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <TextField
              select
              label="Active BigWig Tool (params.active_bigwig_dir)"
              fullWidth
              value={selectedTool}
              onChange={(e) => {
                const toolName = e.target.value;
                const mappedDir =
                  bigwigTools[toolName] ?? DEFAULT_BIGWIG_TOOLS[toolName] ?? "07_homer/ucsc_bw";
                onUpdateField("active_bigwig_dir", mappedDir);
                onUpdateField(
                  "bigwig_source",
                  toolName.toLowerCase().includes("deeptools") ? "deepTools" : "UCSC"
                );
              }}
              helperText="Selects HOMER or deepTools BigWig tracks for plots"
            >
              {toolOptions.map((toolName) => (
                <MenuItem key={toolName} value={toolName}>
                  {toolName}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <TextField
                label="Upstream Input Directory (params.input_dir)"
                fullWidth
                value={config.input_dir}
                onChange={(e) => onUpdateField("input_dir", e.target.value)}
                helperText="Folder containing 08_deeptools/, 07_homer/, and bigWig subfolders"
              />
              <Button
                variant="outlined"
                startIcon={<FolderOpenIcon />}
                onClick={onOpenInputDirBrowser}
                sx={{ whiteSpace: "nowrap", height: 40 }}
              >
                Browse
              </Button>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <FormControl fullWidth size="small" variant="outlined">
              <InputLabel shrink htmlFor="use-igg-control-field">
                Use IgG Negative Control (params.use_igg_control)
              </InputLabel>
              <OutlinedInput
                id="use-igg-control-field"
                notched
                readOnly
                label="Use IgG Negative Control (params.use_igg_control)"
                value={config.use_igg_control ? "Enabled" : "Disabled"}
                onClick={() => onUpdateField("use_igg_control", !config.use_igg_control)}
                sx={{ cursor: "pointer" }}
                 inputProps={{
                  style: { cursor: "pointer" },
                }}
                endAdornment={
                  <InputAdornment position="end">
                    <Switch
                      size="small"
                      edge="end"
                      checked={config.use_igg_control}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => onUpdateField("use_igg_control", e.target.checked)}
                      inputProps={{ "aria-label": "Use IgG Negative Control" }}
                    />
                  </InputAdornment>
                }
              />
              <FormHelperText>
                Pass matched control_id from samplesheet.csv to MACS2/HOMER
              </FormHelperText>
            </FormControl>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
};
