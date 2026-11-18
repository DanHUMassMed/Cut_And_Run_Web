export interface ContrastItem {
  id: string;
  treatment: string;
  background: string;
  target: string;
}

export interface ExperimentConfig {
  email: string;
  experiment: string;
  input_dir: string;
  active_bigwig_dir: string;
  bigwig_source: "deepTools" | "UCSC";
  outdir: string;
  samplesheet: string;

  run_macs2_callpeak: boolean;
  run_homer_findpeaks: boolean;
  use_igg_control: boolean;
  run_merge_replicate_peaks: boolean;
  run_merge_master_peaks: boolean;
  run_homer_annotatepeaks: boolean;
  run_homer_diffpeaks: boolean;
  run_deeptools_metapeak: boolean;
  run_homer_findmotifs: boolean;
  run_meme_streme: boolean;
  run_summary_plots: boolean;

  active_peak_caller: "macs2" | "homer";
  min_replicate_overlap: number;

  genome_name: string;
  homer_dir: string;
  genome_fasta: string;
  chrom_sizes: string;

  macs2_gsize: string;
  macs2_format: "BAMPE" | "BAM" | "BED";
  macs2_scale_to: "small" | "large" | null;
  macs2_nomodel: boolean;
  macs2_extsize: number;
  macs2_narrow_pvalue: number | null;
  macs2_narrow_qvalue: number;
  macs2_broad_qvalue: number;
  macs2_qvalue: number;
  macs2_broad: boolean;
  macs2_broad_cutoff: number;

  homer_narrow_style: "factor" | "histone";
  homer_narrow_fold: number;
  homer_narrow_local_fold: number | null;
  homer_broad_style: "factor" | "histone";
  homer_broad_fold: number;
  homer_broad_local_fold: number | null;
  homer_broad_min_dist: number | null;
  homer_peak_style: "factor" | "histone";
  annotatepeaks_size: string;

  diff_contrasts: ContrastItem[];

  metapeak_upstream: number;
  metapeak_downstream: number;
  metapeak_reference_point: string;
  heatmap_colormap: string;
  heatmap_interpolation: string;

  homer_motif_size: string;
  meme_slop_left: number;
  meme_slop_right: number;
  meme_streme_nmotifs: number;

  volcano_fdr_threshold: number;
  volcano_log2fc_threshold: number;
  volcano_top_n_labels: number;

  resource_cpus: number;
  resource_memory: string;
  resource_time: string;
}

export interface ConfigResponse {
  config: ExperimentConfig;
  raw: string;
}

export interface SamplesheetRow {
  sample_id: string;
  sample_name: string;
  condition: string;
  target: string;
  peak_mode: string;
  replicate: string;
  control_id: string;
}

export interface SamplesheetResponse {
  rows: SamplesheetRow[];
}

export interface DiscoverSamplesResponse {
  discovered: string[];
  error?: string;
}

export interface RunScriptResponse {
  exists: boolean;
  path: string;
  content: string;
}

export interface ProjectInfo {
  path: string;
  label: string;
  name: string;
  experiment: string;
  template_id: string;
  last_opened_at: string;
  pinned: boolean;
  exists: boolean;
  has_config: boolean;
  has_samplesheet: boolean;
  has_run_sh: boolean;
}

export interface ProjectsStateResponse {
  current: ProjectInfo;
  pipeline_dir: string;
  user_config_dir: string;
  recent: ProjectInfo[];
}

export interface DirectoryEntry {
  name: string;
  path: string;
  has_config: boolean;
  has_run_sh: boolean;
}

export interface DirectoryListingResponse {
  current: string;
  parent: string | null;
  home: string;
  pipeline_parent: string;
  directories: DirectoryEntry[];
  error: string | null;
}

export interface TemplateMetadata {
  id: string;
  name: string;
  description: string;
  genome: string;
  created_at: string;
  updated_at: string;
  built_in: boolean;
}

export interface TemplateDetail extends TemplateMetadata {
  experiment_config: string;
  samplesheet_csv: string;
  run_sh: string;
}

export interface TemplateSavePayload {
  id?: string;
  name: string;
  description: string;
  genome: string;
  experiment_config?: string;
  samplesheet_csv?: string;
  run_sh?: string;
  include_samplesheet_rows?: boolean;
}

export interface ProjectCreatePayload {
  target_dir: string;
  experiment_name: string;
  template_id: string;
  email: string;
  input_dir: string;
  overwrite: boolean;
}

export interface ProjectOpenPayload {
  path: string;
  initialize?: boolean;
  experiment_name?: string;
  template_id?: string;
}

export interface PreflightCheckResult {
  name: string;
  status: "ok" | "warning" | "failed";
  detail: string;
}

export interface PreflightResponse {
  ready: boolean;
  checks: PreflightCheckResult[];
  workspace: string;
}

export interface TaskRecord {
  task_id: string;
  key: string;
  name: string;
  process: string;
  process_short: string;
  tag: string;
  hash: string;
  status: string;
  exit: number | null;
  duration: string;
  realtime: number | null;
  realtime_fmt: string;
  cpu_percent: number;
  peak_rss: string | number;
  workdir: string;
}

export interface PipelineStats {
  total: number;
  submitted: number;
  running: number;
  completed: number;
  cached: number;
  failed: number;
  percent: number;
  run_name: string | null;
}

export interface PipelineStatusResponse {
  status: "idle" | "running" | "completed" | "failed" | "cancelled";
  pid: number | null;
  return_code: number | null;
  log_lines_count: number;
  run_name: string | null;
  stats: PipelineStats;
  tasks: TaskRecord[];
  start_time: number | null;
  end_time: number | null;
}

export interface ResultFileItem {
  path: string;
  name: string;
  category: string;
  subfolder: string;
  size: number;
  mtime?: number;
}

export interface ResultsListResponse {
  files: ResultFileItem[];
  experiment?: string;
  results_dir: string;
  exists: boolean;
}
