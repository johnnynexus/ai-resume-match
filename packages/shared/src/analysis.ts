import { z } from "zod";

/**
 * The analysis result shape — the single source of truth shared by the API and
 * the web app. CLAUDE.md: when this changes, update it HERE and the Prisma
 * `resultJson` consumers and the rendering components; they are coupled by
 * design.
 *
 * Two artifacts live in this file and MUST stay in sync:
 *  1. `analysisResultSchema` — the Zod schema we validate Claude's output against
 *     before persisting (don't trust the model blindly).
 *  2. `ANALYSIS_TOOL` — the Claude tool whose `input_schema` is this same shape.
 *     We force `tool_choice` to this tool so Claude must return conforming data.
 */

const importanceEnum = z.enum(["high", "medium", "low"]);
const severityEnum = z.enum(["high", "medium", "low"]);

const scoreBreakdownSchema = z.object({
  skills_match: z.number().int().min(0).max(100),
  experience_match: z.number().int().min(0).max(100),
  keyword_coverage: z.number().int().min(0).max(100),
});

const matchedSkillSchema = z.object({
  skill: z.string().min(1),
  evidence: z.string().min(1),
});

const missingKeywordSchema = z.object({
  keyword: z.string().min(1),
  importance: importanceEnum,
  where_to_add: z.string().min(1),
});

const sectionFeedbackSchema = z.object({
  section: z.string().min(1),
  feedback: z.string().min(1),
  severity: severityEnum,
});

const rewriteSuggestionSchema = z.object({
  original: z.string().min(1),
  improved: z.string().min(1),
  reason: z.string().min(1),
});

export const analysisResultSchema = z.object({
  overall_match_score: z.number().int().min(0).max(100),
  score_breakdown: scoreBreakdownSchema,
  summary: z.string().min(1),
  matched_skills: z.array(matchedSkillSchema),
  missing_keywords: z.array(missingKeywordSchema),
  section_feedback: z.array(sectionFeedbackSchema),
  rewrite_suggestions: z.array(rewriteSuggestionSchema),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;
export type MatchedSkill = z.infer<typeof matchedSkillSchema>;
export type MissingKeyword = z.infer<typeof missingKeywordSchema>;
export type SectionFeedback = z.infer<typeof sectionFeedbackSchema>;
export type RewriteSuggestion = z.infer<typeof rewriteSuggestionSchema>;

export const ANALYSIS_TOOL_NAME = "submit_resume_analysis" as const;

/**
 * JSON Schema handed to Claude as the tool's `input_schema`. Kept adjacent to
 * the Zod schema above so any change is made in one place and reviewed together.
 * This guides the model; `analysisResultSchema` is what actually enforces the
 * contract before we persist anything.
 */
export const ANALYSIS_TOOL = {
  name: ANALYSIS_TOOL_NAME,
  description:
    "Submit the structured analysis of how well the resume matches the job description. " +
    "Call this exactly once with the complete analysis.",
  input_schema: {
    type: "object",
    properties: {
      overall_match_score: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "Overall match score from 0 to 100.",
      },
      score_breakdown: {
        type: "object",
        properties: {
          skills_match: { type: "integer", minimum: 0, maximum: 100 },
          experience_match: { type: "integer", minimum: 0, maximum: 100 },
          keyword_coverage: { type: "integer", minimum: 0, maximum: 100 },
        },
        required: ["skills_match", "experience_match", "keyword_coverage"],
        additionalProperties: false,
      },
      summary: {
        type: "string",
        description: "One honest paragraph summarizing the fit.",
      },
      matched_skills: {
        type: "array",
        description: "Skills from the job description the resume demonstrably has.",
        items: {
          type: "object",
          properties: {
            skill: { type: "string" },
            evidence: {
              type: "string",
              description: "Where/how the resume demonstrates this skill.",
            },
          },
          required: ["skill", "evidence"],
          additionalProperties: false,
        },
      },
      missing_keywords: {
        type: "array",
        description: "Important keywords from the job description not found in the resume.",
        items: {
          type: "object",
          properties: {
            keyword: { type: "string" },
            importance: { type: "string", enum: ["high", "medium", "low"] },
            where_to_add: {
              type: "string",
              description: "Concrete suggestion for where to add this keyword.",
            },
          },
          required: ["keyword", "importance", "where_to_add"],
          additionalProperties: false,
        },
      },
      section_feedback: {
        type: "array",
        description: "Feedback on individual resume sections.",
        items: {
          type: "object",
          properties: {
            section: { type: "string" },
            feedback: { type: "string" },
            severity: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: ["section", "feedback", "severity"],
          additionalProperties: false,
        },
      },
      rewrite_suggestions: {
        type: "array",
        description:
          "Concrete before/after rewrite suggestions. This is the headline feature — " +
          "each becomes an inline before/after diff in the UI.",
        items: {
          type: "object",
          properties: {
            original: { type: "string", description: "The original resume text." },
            improved: { type: "string", description: "The improved version." },
            reason: { type: "string", description: "Why the rewrite is better." },
          },
          required: ["original", "improved", "reason"],
          additionalProperties: false,
        },
      },
    },
    required: [
      "overall_match_score",
      "score_breakdown",
      "summary",
      "matched_skills",
      "missing_keywords",
      "section_feedback",
      "rewrite_suggestions",
    ],
    additionalProperties: false,
  },
} as const;
