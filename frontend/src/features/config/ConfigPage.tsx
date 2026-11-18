import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import CodeIcon from "@mui/icons-material/Code";
import RestoreIcon from "@mui/icons-material/Restore";
import RefreshIcon from "@mui/icons-material/Refresh";
import { api } from "../../api/client";
import type {
  ContrastItem,
  ExperimentConfig,
  SamplesheetRow,
} from "../../types/api";
import { ConfirmDialog } from "../../components/common/ConfirmDialog";
import { PageHeader } from "../../components/common/PageHeader";
import { DirectoryBrowserDialog } from "../../components/projects/DirectoryBrowserDialog";
import { DEFAULT_BIGWIG_TOOLS, IdentityPathsCard } from "./IdentityPathsCard";
import { StepTogglesCard } from "./StepTogglesCard";
import { ContrastsCard, type KeyedContrastItem } from "./ContrastsCard";
import { AdvancedParamsAccordion } from "./AdvancedParamsAccordion";
import { RawConfigDialog } from "./RawConfigDialog";

export interface ConfigPageProps {
  projectPath: string;
  onNotify: (message: string, severity?: "success" | "error" | "info" | "warning") => void;
  onDirtyChange?: (isDirty: boolean) => void;
}

export const ConfigPage: React.FC<ConfigPageProps> = ({
  projectPath,
  onNotify,
  onDirtyChange,
}) => {
  const [config, setConfig] = useState<ExperimentConfig | null>(null);
  const [savedConfig, setSavedConfig] = useState<ExperimentConfig | null>(null);
  const [bigwigTools, setBigwigTools] = useState<Record<string, string>>(DEFAULT_BIGWIG_TOOLS);
  const [contrastKeys, setContrastKeys] = useState<string[]>([]);
  const [rawText, setRawText] = useState<string>("");
  const [samples, setSamples] = useState<SamplesheetRow[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [reloading, setReloading] = useState<boolean>(false);
  const [reloadConfirmOpen, setReloadConfirmOpen] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [rawDialogOpen, setRawDialogOpen] = useState<boolean>(false);
  const [inputDirBrowserOpen, setInputDirBrowserOpen] = useState<boolean>(false);

  const keyCounterRef = useRef<number>(1);
  const nextContrastKey = () => {
    const k = `contrast-${keyCounterRef.current}`;
    keyCounterRef.current += 1;
    return k;
  };

  const loadData = async (isManualReload = false) => {
    if (isManualReload) {
      setReloading(true);
    } else {
      setLoading(true);
    }
    setError(null);
    try {
      const [cfgRes, ssRes] = await Promise.all([
        api.getConfig(),
        api.getSamplesheet().catch(() => ({ rows: [] })),
      ]);
      setConfig(cfgRes.config);
      setSavedConfig(cfgRes.config);
      if (cfgRes.bigwig_tools) {
        setBigwigTools(cfgRes.bigwig_tools);
      }
      setContrastKeys(cfgRes.config.diff_contrasts.map(() => nextContrastKey()));
      setRawText(cfgRes.raw);
      setSamples(ssRes.rows);
      if (isManualReload) {
        onNotify("Reloaded config/experiment.config from disk", "info");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load experiment.config";
      if (isManualReload) {
        onNotify(msg, "error");
      } else {
        setError(msg);
        setConfig(null);
      }
    } finally {
      setLoading(false);
      setReloading(false);
    }
  };

  useEffect(() => {
    void loadData(false);
  }, [projectPath]);

  const isDirty = useMemo(() => {
    if (!config || !savedConfig) return false;
    return JSON.stringify(config) !== JSON.stringify(savedConfig);
  }, [config, savedConfig]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const handleRequestReload = () => {
    if (isDirty) {
      setReloadConfirmOpen(true);
      return;
    }
    void loadData(true);
  };

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

  const keyedContrasts: KeyedContrastItem[] = useMemo(() => {
    if (!config) return [];
    return config.diff_contrasts.map((item, idx) => ({
      ...item,
      _rowKey: contrastKeys[idx] ?? `contrast-fallback-${idx}`,
    }));
  }, [config, contrastKeys]);

  const updateField = <K extends keyof ExperimentConfig>(
    key: K,
    value: ExperimentConfig[K]
  ) => {
    setConfig((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const handleDiscard = () => {
    if (!savedConfig) return;
    setConfig(savedConfig);
    setContrastKeys(savedConfig.diff_contrasts.map(() => nextContrastKey()));
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!config) return;
    setSaving(true);
    try {
      const res = await api.saveConfig(config);
      setConfig(res.config);
      setSavedConfig(res.config);
      setContrastKeys(res.config.diff_contrasts.map((_, i) => contrastKeys[i] ?? nextContrastKey()));
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
    setContrastKeys((prev) => [...prev, nextContrastKey()]);
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
    setContrastKeys((prev) => prev.filter((_, i) => i !== idx));
    updateField(
      "diff_contrasts",
      config.diff_contrasts.filter((_, i) => i !== idx)
    );
  };

  if (loading) {
    return (
      <Stack spacing={3}>
        <Skeleton variant="rounded" height={84} />
        <Skeleton variant="rounded" height={240} />
        <Skeleton variant="rounded" height={280} />
        <Skeleton variant="rounded" height={180} />
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

  const actionButtons = (
    <>
      <Button
        variant="outlined"
        startIcon={<CodeIcon />}
        onClick={() => setRawDialogOpen(true)}
      >
        View Experiment Config
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
        type="submit"
        variant="contained"
        startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        disabled={saving}
      >
        {saving ? "Saving..." : "Save Configuration"}
      </Button>
    </>
  );

  return (
    <Box component="form" onSubmit={handleSave}>
      <Stack spacing={3}>
        <PageHeader
          title="Experiment Configuration"
          badges={
            <Stack direction="row" spacing={0.5} alignItems="center">
              <Chip
                label={isDirty ? "Unsaved Changes" : "Saved"}
                color={isDirty ? "warning" : "success"}
                size="small"
                variant={isDirty ? "filled" : "outlined"}
              />
              <Tooltip title="Reload experiment.config from disk">
                <span>
                  <IconButton
                    size="small"
                    aria-label="Reload experiment.config from disk"
                    disabled={reloading || saving}
                    onClick={handleRequestReload}
                  >
                    {reloading ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <RefreshIcon fontSize="small" />
                    )}
                  </IconButton>
                </span>
              </Tooltip>
            </Stack>
          }
          subtitle={
            <>
              Editing <code>{projectPath}/config/experiment.config</code>
            </>
          }
          actions={actionButtons}
        />

        <IdentityPathsCard
          config={config}
          bigwigTools={bigwigTools}
          onUpdateField={updateField}
          onOpenInputDirBrowser={() => setInputDirBrowserOpen(true)}
        />

        <StepTogglesCard config={config} onUpdateField={updateField} />

        <ContrastsCard
          contrasts={keyedContrasts}
          diffPeaksEnabled={config.run_homer_diffpeaks}
          conditionOptions={conditionOptions}
          targetOptions={targetOptions}
          onAddContrast={handleAddContrast}
          onUpdateContrast={handleUpdateContrast}
          onRemoveContrast={handleRemoveContrast}
        />

        <AdvancedParamsAccordion config={config} onUpdateField={updateField} />

        {isDirty && (
          <Paper
            elevation={3}
            sx={{
              p: 1.5,
              px: 2.5,
              position: "sticky",
              bottom: 16,
              zIndex: (theme) => theme.zIndex.appBar - 1,
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "warning.main",
            }}
          >
            <Stack
              direction="row"
              justifyContent="space-between"
              alignItems="center"
              flexWrap="wrap"
              gap={1.5}
            >
              <Stack direction="row" spacing={1} alignItems="center">
                <Chip label="Unsaved Changes" color="warning" size="small" />
                <Typography variant="body2" color="text.secondary">
                  Save your edits to update <code>config/experiment.config</code>
                </Typography>
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<RestoreIcon />}
                  disabled={saving}
                  onClick={handleDiscard}
                >
                  Discard
                </Button>
                <Button
                  type="submit"
                  size="small"
                  variant="contained"
                  startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Configuration"}
                </Button>
              </Stack>
            </Stack>
          </Paper>
        )}
      </Stack>

      <RawConfigDialog
        open={rawDialogOpen}
        rawText={rawText}
        onClose={() => setRawDialogOpen(false)}
        onNotify={onNotify}
      />

      <ConfirmDialog
        open={reloadConfirmOpen}
        title="Reload Configuration from Disk?"
        message={
          <>
            You have unsaved changes in the form. Reloading{" "}
            <code>config/experiment.config</code> from disk will overwrite your unsaved edits.
          </>
        }
        confirmLabel="Discard & Reload"
        confirmColor="warning"
        busy={reloading}
        onConfirm={() => {
          setReloadConfirmOpen(false);
          void loadData(true);
        }}
        onCancel={() => setReloadConfirmOpen(false)}
      />

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
