import type { FastifyInstance } from "fastify";
import { analyzeRequestSchema, type AnalyzeResponse } from "@resumematch/shared";
import { AppError } from "../lib/errors.js";
import { inputHash } from "../lib/hash.js";
import { getPrisma } from "../lib/prisma.js";
import { extractKeywords } from "../services/keywords.js";
import { analyzeResume } from "../services/llm/index.js";
import { findCachedAnalysis, persistAnalysis } from "../services/cache.js";

export async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/analyze", async (request) => {
    const parsed = analyzeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join("; ");
      throw new AppError("VALIDATION_ERROR", message, 400);
    }

    const { resumeText, jobText } = parsed.data;
    const hash = inputHash(resumeText, jobText);
    const userId = request.userId;

    const prisma = getPrisma();
    if (prisma && userId) {
      const cached = await findCachedAnalysis(prisma, hash, userId);
      if (cached) {
        request.log.info({ hash, userId }, "analysis cache hit");
        return { analysis: cached, cached: true } satisfies AnalyzeResponse;
      }
    }

    const keywords = extractKeywords(jobText);
    const analysis = await analyzeResume({ resumeText, jobText, keywords });

    if (prisma && userId) {
      await persistAnalysis(prisma, {
        userId,
        resumeText,
        resumeFileName: parsed.data.resumeFileName ?? "resume.pdf",
        jobText,
        jobTitle: parsed.data.jobTitle,
        jobCompany: parsed.data.jobCompany,
        inputHash: hash,
        result: analysis,
      });
      request.log.info({ hash, userId }, "analysis persisted");
    } else if (prisma) {
      request.log.info({ hash }, "analysis computed (no userId — not persisted)");
    }

    return { analysis, cached: false } satisfies AnalyzeResponse;
  });
}
