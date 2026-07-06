import { Prisma, type PrismaClient } from "@prisma/client";
import { analysisResultSchema, type AnalysisResult } from "@resumematch/shared";

/**
 * Look up a previously computed analysis by its input hash. CLAUDE.md caching:
 * if an Analysis with that hash exists for the user, return it instead of
 * re-calling the LLM — saves cost and latency on repeat runs. We re-validate the stored JSON against
 * the schema so a stale/older shape can never leak through unchecked.
 */
export async function findCachedAnalysis(
  prisma: PrismaClient,
  inputHash: string,
  userId: string,
): Promise<AnalysisResult | null> {
  const row = await prisma.analysis.findFirst({
    where: { inputHash, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return null;

  const parsed = analysisResultSchema.safeParse(row.resultJson);
  return parsed.success ? parsed.data : null;
}

/**
 * Persist an analysis (Resume + JobDescription + Analysis rows) atomically.
 *
 * Wrapped in an interactive transaction so the three inserts succeed or fail as
 * a unit: if the final Analysis insert fails (e.g. a userId FK violation), the
 * Resume and JobDescription inserts roll back rather than leaving orphan rows.
 */
export async function persistAnalysis(
  prisma: PrismaClient,
  args: {
    userId: string;
    resumeText: string;
    resumeFileName: string;
    jobText: string;
    jobTitle?: string;
    jobCompany?: string;
    inputHash: string;
    result: AnalysisResult;
  },
): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const resume = await tx.resume.create({
      data: { userId: args.userId, fileName: args.resumeFileName, parsedText: args.resumeText },
    });
    const jd = await tx.jobDescription.create({
      data: {
        userId: args.userId,
        title: args.jobTitle,
        company: args.jobCompany,
        rawText: args.jobText,
      },
    });
    await tx.analysis.create({
      data: {
        userId: args.userId,
        resumeId: resume.id,
        jobDescriptionId: jd.id,
        overallScore: args.result.overall_match_score,
        // AnalysisResult is plain JSON-serializable data; cast to Prisma's Json input type.
        resultJson: args.result as unknown as Prisma.InputJsonValue,
        inputHash: args.inputHash,
      },
    });
  });
}
