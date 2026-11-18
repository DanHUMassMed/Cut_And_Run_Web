import type {
  ConfigResponse,
  ContrastItem,
  DirectoryListingResponse,
  DiscoverSamplesResponse,
  ExperimentConfig,
  PipelineStatusResponse,
  PreflightResponse,
  ProjectCreatePayload,
  ProjectOpenPayload,
  ProjectsStateResponse,
  ResultsListResponse,
  RunScriptResponse,
  SamplesheetResponse,
  SamplesheetRow,
  TemplateDetail,
  TemplateMetadata,
  TemplateSavePayload,
} from "../types/api";

export class ApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const errBody = (await response.json()) as { detail?: unknown };
      if (typeof errBody.detail === "string") {
        message = errBody.detail;
      } else if (Array.isArray(errBody.detail)) {
        message = errBody.detail
          .map((item: { msg?: string; loc?: unknown[] }) =>
            item.loc ? `${item.loc.slice(1).join(".")}: ${item.msg ?? "invalid"}` : (item.msg ?? "Validation error")
          )
          .join("; ");
      }
    } catch {
      // Fallback to status text
    }
    throw new ApiError(message, response.status);
  }

  return (await response.json()) as T;
}

export const api = {
  // Projects & Workspaces
  getProjectsState: (): Promise<ProjectsStateResponse> =>
    requestJson<ProjectsStateResponse>("/api/projects"),

  createProject: (payload: ProjectCreatePayload): Promise<ProjectsStateResponse> =>
    requestJson<ProjectsStateResponse>("/api/projects/create", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  openProject: (payload: ProjectOpenPayload): Promise<ProjectsStateResponse> =>
    requestJson<ProjectsStateResponse>("/api/projects/open", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  removeProjectHistory: (path: string): Promise<ProjectsStateResponse> =>
    requestJson<ProjectsStateResponse>(
      `/api/projects/history?path=${encodeURIComponent(path)}`,
      { method: "DELETE" }
    ),

  listDirectories: (path?: string): Promise<DirectoryListingResponse> => {
    const query = path ? `?path=${encodeURIComponent(path)}` : "";
    return requestJson<DirectoryListingResponse>(`/api/projects/list-dirs${query}`);
  },

  // Templates (~/.config/cutandrun_web/templates)
  listTemplates: async (): Promise<TemplateMetadata[]> => {
    const res = await requestJson<{ templates: TemplateMetadata[] }>("/api/templates");
    return res.templates;
  },

  getTemplate: async (templateId: string): Promise<TemplateDetail> => {
    const res = await requestJson<{ template: TemplateDetail }>(
      `/api/templates/${encodeURIComponent(templateId)}`
    );
    return res.template;
  },

  saveTemplateFromProject: async (payload: TemplateSavePayload): Promise<TemplateDetail> => {
    const res = await requestJson<{ status: string; template: TemplateDetail }>(
      "/api/templates/from-project",
      {
        method: "POST",
        body: JSON.stringify(payload),
      }
    );
    return res.template;
  },

  deleteTemplate: (templateId: string): Promise<{ status: string; deleted: string }> =>
    requestJson<{ status: string; deleted: string }>(
      `/api/templates/${encodeURIComponent(templateId)}`,
      { method: "DELETE" }
    ),

  // Experiment Config
  getConfig: (): Promise<ConfigResponse> => requestJson<ConfigResponse>("/api/config"),

  saveConfig: (config: ExperimentConfig): Promise<ConfigResponse> =>
    requestJson<ConfigResponse>("/api/config", {
      method: "PUT",
      body: JSON.stringify(config),
    }),

  saveContrasts: (
    diff_contrasts: ContrastItem[]
  ): Promise<{ status: string; diff_contrasts: ContrastItem[] }> =>
    requestJson<{ status: string; diff_contrasts: ContrastItem[] }>("/api/config/contrasts", {
      method: "PATCH",
      body: JSON.stringify({ diff_contrasts }),
    }),

  // Samplesheet
  getSamplesheet: (): Promise<SamplesheetResponse> =>
    requestJson<SamplesheetResponse>("/api/samplesheet"),

  saveSamplesheet: (rows: SamplesheetRow[]): Promise<{ status: string; count: number }> =>
    requestJson<{ status: string; count: number }>("/api/samplesheet", {
      method: "PUT",
      body: JSON.stringify({ rows }),
    }),

  discoverSamples: (): Promise<DiscoverSamplesResponse> =>
    requestJson<DiscoverSamplesResponse>("/api/samplesheet/discover", {
      method: "POST",
    }),

  // run.sh
  getRunScript: (): Promise<RunScriptResponse> =>
    requestJson<RunScriptResponse>("/api/run-script"),

  saveRunScript: (content: string): Promise<RunScriptResponse> =>
    requestJson<RunScriptResponse>("/api/run-script", {
      method: "PUT",
      body: JSON.stringify({ content }),
    }),

  resetRunScript: (templateId = "default_ce11"): Promise<RunScriptResponse> =>
    requestJson<RunScriptResponse>("/api/run-script/reset", {
      method: "POST",
      body: JSON.stringify({ template_id: templateId }),
    }),

  // Pipeline & Preflight
  runPreflight: (): Promise<PreflightResponse> =>
    requestJson<PreflightResponse>("/api/preflight", { method: "POST" }),

  getPipelineStatus: (): Promise<PipelineStatusResponse> =>
    requestJson<PipelineStatusResponse>("/api/pipeline/status"),

  startPipeline: (resume: boolean): Promise<{ status: string; pid: number; start_time: number }> =>
    requestJson<{ status: string; pid: number; start_time: number }>("/api/pipeline/start", {
      method: "POST",
      body: JSON.stringify({ resume }),
    }),

  stopPipeline: (): Promise<{ status: string }> =>
    requestJson<{ status: string }>("/api/pipeline/stop", { method: "POST" }),

  // Results
  getResultsFiles: (): Promise<ResultsListResponse> =>
    requestJson<ResultsListResponse>("/api/results/files"),

  openResultsInFinder: (): Promise<{ status: string; path: string }> =>
    requestJson<{ status: string; path: string }>("/api/results/open-finder", {
      method: "POST",
    }),

  deleteResultFile: (filePath: string): Promise<{ status: string; deleted: string }> =>
    requestJson<{ status: string; deleted: string }>(
      `/api/results/file/${encodeURI(filePath)}`,
      { method: "DELETE" }
    ),

  // Server Shutdown
  shutdownServer: (force = false): Promise<{ status: string }> =>
    requestJson<{ status: string }>("/api/server/shutdown", {
      method: "POST",
      body: JSON.stringify({ force }),
    }),
};
