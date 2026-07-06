import { test, expect } from "@playwright/test";

/**
 * Happy-path flow: sign in → upload resume → paste JD → see an analysis render.
 *
 * Requires AUTH_TEST_MODE=true in apps/web/.env and a running DB + API stack.
 */
test("analyzes a resume against a job description", async ({ page }) => {
  await page.goto("/api/auth/signin");

  if (process.env.AUTH_TEST_MODE === "true") {
    await page.getByLabel("Email").fill("e2e@resumematch.test");
    await page.getByRole("button", { name: /sign in with test/i }).click();
    await page.waitForURL("/");
  } else {
    test.skip(true, "Set AUTH_TEST_MODE=true for automated sign-in, or sign in manually.");
  }

  await expect(page.getByRole("heading", { name: "Analyze a match" })).toBeVisible();

  await page.setInputFiles('input[type="file"]', "e2e/fixtures/sample-resume.pdf");

  await page
    .getByPlaceholder("Paste the job description here…")
    .fill(
      "Senior Full-Stack Engineer. TypeScript, React, Node.js, PostgreSQL, Docker, AWS. 5+ years.",
    );

  await page.getByRole("button", { name: /analyze match/i }).click();

  await expect(page.getByText("/ 100 overall match")).toBeVisible({ timeout: 120_000 });
});
