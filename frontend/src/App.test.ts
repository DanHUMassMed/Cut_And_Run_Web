import { describe, expect, it } from "vitest";
import { ApiError } from "./api/client";
import { isAdminRoute } from "./main";
import { parseNumericInput } from "./features/config/AdvancedParamsAccordion";
import { resolveBigwigToolName } from "./features/config/IdentityPathsCard";
import {
  parseSamplesheetCsv,
  validateSamplesheetRows,
} from "./features/samplesheet/SamplesheetPage";
import { formatElapsed } from "./features/pipeline/PipelinePage";
import { formatBytes } from "./features/results/ResultsPage";
import { buildBreadcrumbs } from "./components/projects/DirectoryBrowserDialog";

describe("ApiError", () => {
  it("stores HTTP status code and message", () => {
    const err = new ApiError("Not found", 404);
    expect(err.message).toBe("Not found");
    expect(err.status).toBe(404);
    expect(err.name).toBe("ApiError");
  });
});

describe("isAdminRoute", () => {
  it("matches /admin and subpaths without matching base app routes", () => {
    expect(isAdminRoute("/admin")).toBe(true);
    expect(isAdminRoute("/admin/")).toBe(true);
    expect(isAdminRoute("/admin/templates")).toBe(true);
    expect(isAdminRoute("/")).toBe(false);
    expect(isAdminRoute("/administrator")).toBe(false);
  });
});

describe("parseNumericInput", () => {
  it("preserves 0 without falling back to default", () => {
    expect(parseNumericInput("0", 20, false)).toBe(0);
    expect(parseNumericInput("0.0", 1.5, false)).toBe(0);
  });

  it("returns null or fallback when blank", () => {
    expect(parseNumericInput("   ", 147, false)).toBe(147);
    expect(parseNumericInput("", 147, true)).toBeNull();
  });
});

describe("validateSamplesheetRows", () => {
  it("detects empty sample_id, duplicates, and unmatched control_id", () => {
    const result = validateSamplesheetRows([
      {
        sample_id: "S1",
        sample_name: "Sample 1",
        condition: "WT",
        target: "H3K4me3",
        peak_mode: "narrow",
        replicate: "1",
        control_id: "Missing_IgG",
      },
      {
        sample_id: "S1",
        sample_name: "Sample 1 Dup",
        condition: "WT",
        target: "H3K4me3",
        peak_mode: "narrow",
        replicate: "2",
        control_id: "",
      },
      {
        sample_id: "   ",
        sample_name: "Empty ID",
        condition: "WT",
        target: "IgG",
        peak_mode: "",
        replicate: "1",
        control_id: "",
      },
    ]);

    expect(result.warnings.length).toBe(3);
    expect(result.rowErrors[0]?.sampleIdError).toContain("Duplicate");
    expect(result.rowErrors[0]?.controlIdError).toContain("Missing_IgG");
    expect(result.rowErrors[1]?.sampleIdError).toContain("Duplicate");
    expect(result.rowErrors[2]?.sampleIdError).toBe("sample_id is required");
  });
});

describe("formatters & breadcrumbs", () => {
  it("formats elapsed seconds and byte sizes", () => {
    expect(formatElapsed(65)).toBe("01:05");
    expect(formatElapsed(3661)).toBe("01:01:01");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("builds breadcrumb segments for POSIX paths", () => {
    expect(buildBreadcrumbs("/Users/dan/Project")).toEqual([
      { label: "/", path: "/" },
      { label: "Users", path: "/Users" },
      { label: "dan", path: "/Users/dan" },
      { label: "Project", path: "/Users/dan/Project" },
    ]);
  });

  it("maps BigWig directories to tool names", () => {
    expect(resolveBigwigToolName("07_homer/ucsc_bw", "UCSC")).toBe("HOMER");
    expect(resolveBigwigToolName("08_deeptools/bw", "deepTools")).toBe("deepTools");
  });

  it("parses dropped samplesheet.csv text", () => {
    const csv = [
      "sample_id,sample_name,condition,target,peak_mode,replicate,control_id",
      "S1,Sample_1,WT,H3K4me3,narrow,1,IgG_1",
      "IgG_1,IgG_Control,WT,IgG,,1,",
    ].join("\n");
    const rows = parseSamplesheetCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]?.sample_id).toBe("S1");
    expect(rows[0]?.control_id).toBe("IgG_1");
    expect(rows[1]?.peak_mode).toBe("");
  });
});
