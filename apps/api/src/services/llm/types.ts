import type { AnalysisResult } from "@resumematch/shared";
import type { KeywordCandidate } from "../keywords.js";

export type AnalyzeInput = {
  resumeText: string;
  jobText: string;
  keywords: KeywordCandidate[];
};

export type LlmProviderName = "gemini" | "claude";

export interface LlmProvider {
  readonly name: LlmProviderName;
  analyzeResume(input: AnalyzeInput): Promise<AnalysisResult>;
}
