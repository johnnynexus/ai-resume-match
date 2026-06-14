import type { FastifyInstance } from "fastify";
import { analyzeRequestSchema, type AnalyzeResponse } from "@resumematch/shared";
import { AppError } from "../lib/errors.js";
import { inputHash } from "../lib/hash.js";
import { getPrisma } from "../lib/prisma.js";
import { extractKeywords } from "../services/keywords.js";
import { analyzeResume } from "../services/claude.js";
import { findCachedAnalysis } from "../services/cache.js";

export async function analyzeRoutes(app: FastifyInstance): Promise<void> {
  app.post("/api/analyze", async (request) => {
    const parsed = analyzeRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      const message = parsed.error.issues.map((i) => i.message).join("; ");
      throw new AppError("VALIDATION_ERROR", message, 400);
    }

    const { resumeText, jobText } = parsed.data;
    const hash = inputHash(resumeText, jobText);

    // Cache check (CLAUDE.md): return a prior analysis with the same input hash
    // instead of re-calling Claude. Active once DATABASE_URL is configured.
    const prisma = getPrisma();
    if (prisma) {
      const cached = await findCachedAnalysis(prisma, hash);
      if (cached) {
        request.log.info({ hash }, "analysis cache hit");
        return { analysis: cached, cached: true } satisfies AnalyzeResponse;
      }
    }

    const keywords = extractKeywords(jobText);
    const analysis = await analyzeResume({ resumeText, jobText, keywords });

    // NOTE: persistence (persistAnalysis) is intentionally deferred until auth
    // lands and a real userId is available to attribute the Analysis to.
    if (prisma) {
      request.log.info({ hash }, "analysis computed (persistence pending auth)");
    }

    return { analysis, cached: false } satisfies AnalyzeResponse;
  });
}
