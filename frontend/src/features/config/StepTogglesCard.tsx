import React from "react";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  CardHeader,
  Chip,
  Divider,
  Grid2 as Grid,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import type { ExperimentConfig } from "../../types/api";

export interface StepToggleDefinition {
  key: keyof ExperimentConfig;
  label: string;
  step: string;
  description: string;
}

export const STEP_TOGGLES: StepToggleDefinition[] = [
  {
    key: "run_macs2_callpeak",
    label: "MACS2 Peak Calling",
    step: "Step a",
    description: "Call narrow/broad peaks per sample using MACS2",
  },
  {
    key: "run_homer_findpeaks",
    label: "HOMER findPeaks",
    step: "Step a",
    description: "Call factor/histone peaks using HOMER tag directories",
  },
  {
    key: "run_merge_replicate_peaks",
    label: "Merge Replicate Peaks",
    step: "Step b",
    description: "Keep consensus peaks present in >= min_replicate_overlap replicates",
  },
  {
    key: "run_merge_master_peaks",
    label: "Merge Master Peaks",
    step: "Step b",
    description: "Create master union peak set across conditions per target",
  },
  {
    key: "run_homer_annotatepeaks",
    label: "HOMER annotatePeaks",
    step: "Step c",
    description: "Genomic feature annotation and tag quantification across peaks",
  },
  {
    key: "run_homer_diffpeaks",
    label: "HOMER Differential Peaks",
    step: "Step c",
    description: "Run getDifferentialPeaksReplicates for configured contrasts",
  },
  {
    key: "run_deeptools_metapeak",
    label: "deepTools Metapeak & Tornado",
    step: "Step d",
    description: "Generate computeMatrix and plotHeatmap signal profiles",
  },
  {
    key: "run_homer_findmotifs",
    label: "HOMER Motif Discovery",
    step: "Step d",
    description: "Run findMotifsGenome.pl on merged and differential peaks",
  },
  {
    key: "run_meme_streme",
    label: "MEME STREME Motifs",
    step: "Step d",
    description: "De novo motif discovery using MEME Suite STREME",
  },
  {
    key: "run_summary_plots",
    label: "Summary & Volcano QC Plots",
    step: "Step d",
    description: "Automated peak counts, annotation distributions, and volcano plots",
  },
];

export interface StepTogglesCardProps {
  config: ExperimentConfig;
  onUpdateField: <K extends keyof ExperimentConfig>(key: K, value: ExperimentConfig[K]) => void;
}

export const StepTogglesCard: React.FC<StepTogglesCardProps> = ({ config, onUpdateField }) => {
  const enabledCount = STEP_TOGGLES.filter((item) => Boolean(config[item.key])).length;

  const handleSetAll = (enabled: boolean) => {
    for (const item of STEP_TOGGLES) {
      onUpdateField(item.key, enabled as never);
    }
  };

  return (
    <Card>
      <CardHeader
        title={
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
            <Typography variant="h6">2. Pipeline Step Toggles</Typography>
            <Chip
              label={`${enabledCount} / ${STEP_TOGGLES.length} enabled`}
              size="small"
              color={enabledCount > 0 ? "primary" : "default"}
              variant="outlined"
            />
          </Stack>
        }
        subheader="Click any module card to enable or skip individual downstream analysis steps"
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" variant="outlined" onClick={() => handleSetAll(true)}>
              Enable All
            </Button>
            <Button
              size="small"
              variant="outlined"
              color="inherit"
              onClick={() => handleSetAll(false)}
            >
              Disable All
            </Button>
          </Stack>
        }
      />
      <Divider />
      <CardContent>
        <Grid container spacing={2}>
          {STEP_TOGGLES.map((item) => {
            const checked = Boolean(config[item.key]);
            return (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={item.key}>
                <Card
                  variant="outlined"
                  sx={(theme) => ({
                    height: "100%",
                    bgcolor: checked
                      ? alpha(theme.palette.primary.main, 0.05)
                      : "background.paper",
                    borderColor: checked ? "primary.main" : "divider",
                    transition: "all 0.15s ease",
                  })}
                >
                  <CardActionArea
                    onClick={() => onUpdateField(item.key, (!checked) as never)}
                    sx={{ p: 1.5, height: "100%", alignItems: "flex-start" }}
                  >
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ width: "100%" }}
                    >
                      <Box sx={{ pr: 1 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip
                            label={item.step}
                            size="small"
                            color={checked ? "primary" : "default"}
                            variant={checked ? "filled" : "outlined"}
                          />
                          <Typography variant="subtitle2">{item.label}</Typography>
                        </Stack>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ display: "block", mt: 0.5 }}
                        >
                          {item.description}
                        </Typography>
                      </Box>
                      <Switch
                        size="small"
                        checked={checked}
                        tabIndex={-1}
                        inputProps={{ "aria-label": item.label }}
                      />
                    </Stack>
                  </CardActionArea>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
};
