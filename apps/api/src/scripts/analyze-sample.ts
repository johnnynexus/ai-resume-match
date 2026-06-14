import "dotenv/config";
import { extractKeywords } from "../services/keywords.js";
import { analyzeResume } from "../services/claude.js";

/**
 * Run the Claude core against hardcoded text — no HTTP, DB, UI, or auth.
 * This is the "de-risk the project" path from CLAUDE.md: prove the forced
 * tool-use call returns clean, validated, schema-conforming data first.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm --filter api analyze:sample
 */

const SAMPLE_RESUME = `
Jane Developer
Software Engineer

EXPERIENCE
Acme Corp — Software Engineer (2022–present)
- Built internal tools with React and TypeScript.
- Worked on the backend API and fixed bugs.
- Collaborated with the design team on the UI.

Beta Inc — Junior Developer (2020–2022)
- Wrote Python scripts for data processing.
- Helped maintain a PostgreSQL database.

SKILLS
TypeScript, React, Python, PostgreSQL, Git

EDUCATION
B.S. Computer Science, State University (2020)
`.trim();

const SAMPLE_JOB = `
Senior Full-Stack Engineer

We're looking for a senior full-stack engineer to build our customer-facing
platform. You'll work across the stack with TypeScript, React, and Node.js,
design and ship REST APIs, and own features end to end.

Requirements:
- 5+ years building production web applications
- Strong TypeScript and React experience
- Experience with Node.js backends and PostgreSQL
- Familiarity with Docker and AWS
- Experience with CI/CD and automated testing (Vitest or Jest)

Nice to have:
- Kubernetes
- GraphQL
`.trim();

async function main() {
  const keywords = extractKeywords(SAMPLE_JOB);
  console.log("Deterministic keyword baseline:");
  console.log(keywords.map((k) => `  - ${k.keyword}${k.known ? " (known skill)" : ""}`).join("\n"));
  console.log("\nCalling Claude (forced tool use, streaming)...\n");

  const result = await analyzeResume({
    resumeText: SAMPLE_RESUME,
    jobText: SAMPLE_JOB,
    keywords,
  });

  console.log(JSON.stringify(result, null, 2));
  console.log(`\nOverall match score: ${result.overall_match_score}/100`);
}

main().catch((err) => {
  console.error("Sample run failed:", err);
  process.exit(1);
});
