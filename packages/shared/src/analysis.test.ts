import { describe, it, expect } from "vitest";
import { analysisResultSchema, ANALYSIS_TOOL, type AnalysisResult } from "./analysis.js";

const validResult: AnalysisResult = {
  overall_match_score: 72,
  score_breakdown: {
    skills_match: 80,
    experience_match: 65,
    keyword_coverage: 70,
  },
  summary: "A solid match with a few gaps in cloud experience.",
  matched_skills: [{ skill: "TypeScript", evidence: "Built a Next.js app in TypeScript." }],
  missing_keywords: [
    { keyword: "Kubernetes", importance: "high", where_to_add: "Add to the skills section." },
  ],
  section_feedback: [
    { section: "Experience", feedback: "Quantify impact with metrics.", severity: "medium" },
  ],
  rewrite_suggestions: [
    {
      original: "Worked on the backend.",
      improved: "Built and shipped 12 REST endpoints serving 50k req/day.",
      reason: "Specific and quantified.",
    },
  ],
};

describe("analysisResultSchema", () => {
  it("accepts a well-formed analysis result", () => {
    const parsed = analysisResultSchema.safeParse(validResult);
    expect(parsed.success).toBe(true);
  });

  it("rejects an out-of-range overall score", () => {
    const bad = { ...validResult, overall_match_score: 150 };
    const parsed = analysisResultSchema.safeParse(bad);
    expect(parsed.success).toBe(false);
  });

  it("rejects a non-integer score", () => {
    const bad = { ...validResult, overall_match_score: 72.5 };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects an invalid importance enum value", () => {
    const bad = {
      ...validResult,
      missing_keywords: [{ keyword: "Go", importance: "critical", where_to_add: "skills" }],
    };
    expect(analysisResultSchema.safeParse(bad).success).toBe(false);
  });

  it("rejects missing required top-level fields", () => {
    const { summary: _summary, ...rest } = validResult;
    expect(analysisResultSchema.safeParse(rest).success).toBe(false);
  });

  it("strips unknown keys rather than failing (Zod default object behavior)", () => {
    const withExtra = { ...validResult, _injected: "ignore me" };
    const parsed = analysisResultSchema.parse(withExtra);
    expect(parsed).not.toHaveProperty("_injected");
  });
});

describe("ANALYSIS_TOOL", () => {
  it("declares every required field present in the schema", () => {
    const required = ANALYSIS_TOOL.input_schema.required;
    expect(required).toEqual([
      "overall_match_score",
      "score_breakdown",
      "summary",
      "matched_skills",
      "missing_keywords",
      "section_feedback",
      "rewrite_suggestions",
    ]);
  });

  it("is the object type and disallows additional properties", () => {
    expect(ANALYSIS_TOOL.input_schema.type).toBe("object");
    expect(ANALYSIS_TOOL.input_schema.additionalProperties).toBe(false);
  });
});
