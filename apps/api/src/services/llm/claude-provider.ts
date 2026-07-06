import Anthropic from "@anthropic-ai/sdk";
import {
  ANALYSIS_TOOL,
  ANALYSIS_TOOL_NAME,
  analysisResultSchema,
  type AnalysisResult,
} from "@resumematch/shared";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt.js";
import type { AnalyzeInput, LlmProvider } from "./types.js";

export class ClaudeProvider implements LlmProvider {
  readonly name = "claude" as const;

  private readonly client: Anthropic;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  /**
   * Forces Claude to return schema-conforming structured data via tool use,
   * streams the response to avoid request timeouts, then validates with Zod.
   */
  async analyzeResume({ resumeText, jobText, keywords }: AnalyzeInput): Promise<AnalysisResult> {
    const tools = [ANALYSIS_TOOL as unknown as Anthropic.Tool];

    const stream = this.client.messages.stream({
      model: this.model,
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
}
