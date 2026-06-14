import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSIS_TOOL,
  ANALYSIS_TOOL_NAME,
  analysisResultSchema,
  type AnalysisResult,
} from "@resumematch/shared";
import { getConfig } from "../lib/config.js";
import { AppError } from "../lib/errors.js";
import { logger } from "../lib/logger.js";
import type { KeywordCandidate } from "./keywords.js";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey: getConfig().anthropicApiKey });
  return client;
}

const SYSTEM_PROMPT = [
  "You are an expert technical recruiter and resume coach.",
  "You analyze how well a candidate's resume matches a specific job description.",
  "Be honest and specific — do not inflate scores. Ground every matched skill in",
  "concrete evidence from the resume, and make rewrite suggestions concrete and",
  "achievable (improve real lines from the resume; never invent accomplishments).",
  "A deterministic keyword baseline extracted from the job description is provided",
  "to focus your attention; use it, but rely on your own semantic judgment for the",
  "final analysis.",
].join(" ");

function buildUserMessage(
  resumeText: string,
  jobText: string,
  keywords: KeywordCandidate[],
): string {
  const baseline = keywords.map((k) => k.keyword).join(", ") || "(none extracted)";
  return [
    "Analyze this resume against the job description and submit your analysis via the tool.",
    "",
    "## Deterministic keyword baseline (from the job description)",
    baseline,
    "",
    "## Job description",
    jobText,
    "",
    "## Resume",
    resumeText,
  ].join("\n");
}

export type AnalyzeInput = {
  resumeText: string;
  jobText: string;
  keywords: KeywordCandidate[];
};

/**
 * The core of the app. Forces Claude to return schema-conforming structured data
 * via tool use (CLAUDE.md design choice #2), streams the response to avoid request
 * timeouts during long generations, then validates the model's output with Zod
 * before returning it — we never trust the model blindly.
 */
export async function analyzeResume({
  resumeText,
  jobText,
  keywords,
}: AnalyzeInput): Promise<AnalysisResult> {
  const cfg = getConfig();

  // `ANALYSIS_TOOL` is a readonly `as const` literal (single source of truth in
  // packages/shared); cast to the SDK's mutable Tool type at this boundary.
  const tools = [ANALYSIS_TOOL as unknown as Anthropic.Tool];

  const stream = getClient().messages.stream({
    model: cfg.model,
    max_tokens: 8000,
    system: SYSTEM_PROMPT,
    tools,
    tool_choice: { type: "tool", name: ANALYSIS_TOOL_NAME },
    messages: [{ role: "user", content: buildUserMessage(resumeText, jobText, keywords) }],
  });

  const message = await stream.finalMessage();

  const toolUse = message.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && block.name === ANALYSIS_TOOL_NAME,
  );

  if (!toolUse) {
    logger.error({ stopReason: message.stop_reason }, "Claude did not return the analysis tool call");
    throw new AppError(
      "MODEL_NO_TOOL_USE",
      "The analysis could not be generated. Please try again.",
      502,
    );
  }

  const parsed = analysisResultSchema.safeParse(toolUse.input);
  if (!parsed.success) {
    logger.error({ issues: parsed.error.issues }, "Claude output failed schema validation");
    throw new AppError(
      "INVALID_MODEL_OUTPUT",
      "The analysis result was malformed. Please try again.",
      502,
    );
  }

  return parsed.data;
}
