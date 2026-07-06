import { getConfig } from "../../lib/config.js";
import { ClaudeProvider } from "./claude-provider.js";
import { GeminiProvider } from "./gemini-provider.js";
import type { AnalyzeInput, LlmProvider } from "./types.js";
import type { AnalysisResult } from "@resumematch/shared";

let cachedProvider: LlmProvider | null = null;

export function getLlmProvider(): LlmProvider {
  if (cachedProvider) return cachedProvider;

  const cfg = getConfig();
  switch (cfg.llmProvider) {
    case "gemini":
      cachedProvider = new GeminiProvider(cfg.geminiApiKey!, cfg.model);
      break;
    case "claude":
      cachedProvider = new ClaudeProvider(cfg.anthropicApiKey!, cfg.model);
      break;
  }
  return cachedProvider;
}

export async function analyzeResume(input: AnalyzeInput): Promise<AnalysisResult> {
  return getLlmProvider().analyzeResume(input);
}

export type { AnalyzeInput, LlmProvider, LlmProviderName } from "./types.js";
