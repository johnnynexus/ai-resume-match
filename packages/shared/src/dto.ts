import { z } from "zod";
import { analysisResultSchema } from "./analysis.js";

/**
 * DTOs for the API boundary, shared by web and API. The API validates incoming
 * requests against these (Zod at the boundary, per CLAUDE.md).
 */

export const analyzeRequestSchema = z.object({
  /** Parsed resume text. The web app uploads a PDF; the API parses it and may
   *  also accept already-parsed text for testing/non-PDF flows. */
  resumeText: z.string().min(1, "resumeText is required"),
  jobText: z.string().min(1, "jobText is required"),
  /** Optional metadata, surfaced in history. */
  resumeFileName: z.string().optional(),
  jobTitle: z.string().optional(),
  jobCompany: z.string().optional(),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;

export const analyzeResponseSchema = z.object({
  analysis: analysisResultSchema,
  /** True when the result was served from the input-hash cache. */
  cached: z.boolean(),
});

export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

/** Structured error envelope returned by the API on failure. */
export type ApiError = {
  error: {
    code: string;
    message: string;
  };
};
