import type { KeywordCandidate } from "../keywords.js";

export const SYSTEM_PROMPT = [
  "You are an expert technical recruiter and resume coach.",
  "You analyze how well a candidate's resume matches a specific job description.",
  "Be honest and specific — do not inflate scores. Ground every matched skill in",
  "concrete evidence from the resume, and make rewrite suggestions concrete and",
  "achievable (improve real lines from the resume; never invent accomplishments).",
  "A deterministic keyword baseline extracted from the job description is provided",
  "to focus your attention; use it, but rely on your own semantic judgment for the",
  "final analysis.",
].join(" ");

export function buildUserMessage(
  resumeText: string,
  jobText: string,
  keywords: KeywordCandidate[],
): string {
  const baseline = keywords.map((k) => k.keyword).join(", ") || "(none extracted)";
  return [
    "Analyze this resume against the job description and return the complete analysis.",
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
