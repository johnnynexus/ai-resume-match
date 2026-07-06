import { GoogleGenAI } from "@google/genai";
import { ANALYSIS_JSON_SCHEMA, analysisResultSchema, type AnalysisResult } from "@resumematch/shared";
import { AppError } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";
import { buildUserMessage, SYSTEM_PROMPT } from "./prompt.js";
import type { AnalyzeInput, LlmProvider } from "./types.js";

export class GeminiProvider implements LlmProvider {
  readonly name = "gemini" as const;

  private readonly client: GoogleGenAI;
  private readonly model: string;

  constructor(apiKey: string, model: string) {
    this.client = new GoogleGenAI({ apiKey });
    this.model = model;
  }

  /**
   * Uses Gemini structured output (responseJsonSchema) to force schema-conforming
   * JSON, streams the response to avoid request timeouts, then validates with Zod.
   */
  async analyzeResume({ resumeText, jobText, keywords }: AnalyzeInput): Promise<AnalysisResult> {
    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: buildUserMessage(resumeText, jobText, keywords),
      config: {
        systemInstruction: SYSTEM_PROMPT,
        maxOutputTokens: 8000,
        responseMimeType: "application/json",
        responseJsonSchema: ANALYSIS_JSON_SCHEMA,
      },
    });

    let text = "";
    for await (const chunk of stream) {
      if (chunk.text) text += chunk.text;
    }

    if (!text.trim()) {
      logger.error("Gemini returned empty structured output");
      throw new AppError(
        "MODEL_EMPTY_OUTPUT",
        "The analysis could not be generated. Please try again.",
        502,
      );
    }

    let raw: unknown;
    try {
      raw = JSON.parse(text);
    } catch {
      logger.error({ textPreview: text.slice(0, 200) }, "Gemini output was not valid JSON");
      throw new AppError(
        "INVALID_MODEL_OUTPUT",
        "The analysis result was malformed. Please try again.",
        502,
      );
    }

    const parsed = analysisResultSchema.safeParse(raw);
    if (!parsed.success) {
      logger.error({ issues: parsed.error.issues }, "Gemini output failed schema validation");
      throw new AppError(
        "INVALID_MODEL_OUTPUT",
        "The analysis result was malformed. Please try again.",
        502,
      );
    }

    return parsed.data;
  }
}
