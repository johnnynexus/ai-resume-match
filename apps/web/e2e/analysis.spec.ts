import { test, expect } from "@playwright/test";

/**
 * Happy-path flow: upload resume → paste JD → see an analysis render.
 *
 * TODO(auth): prepend the sign-in step once Auth.js is wired up. For now the
 * flow runs unauthenticated.
 *
 * This test drives the real stack (web + API + Claude), so it lives behind
 * `pnpm --filter web test:e2e` and is not part of the unit `pnpm test` run.
 * Point it at a small text-based sample PDF placed at e2e/fixtures/sample-resume.pdf.
 */
test("analyzes a resume against a job description", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "ResumeMatch" })).toBeVisible();

  await page.setInputFiles('input[type="file"]', "e2e/fixtures/sample-resume.pdf");

  await page
    .getByPlaceholder("Paste the job description here…")
    .fill(
      "Senior Full-Stack Engineer. TypeScript, React, Node.js, PostgreSQL, Docker, AWS. 5+ years.",
    );

  await page.getByRole("button", { name: /analyze match/i }).click();

  // The analysis call can take a while; wait for the score heading to appear.
  await expect(page.getByText("/ 100 overall match")).toBeVisible({ timeout: 60_000 });
});
