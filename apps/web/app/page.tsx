"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import type { AnalyzeResponse } from "@resumematch/shared";
import { analyze, parseResume, ApiRequestError } from "@/lib/api";
import { AnalysisView } from "@/components/AnalysisView";
import { AuthButton } from "@/components/AuthButton";

export default function HomePage() {
  const { data: session, status } = useSession();
  const [file, setFile] = useState<File | null>(null);
  const [jobText, setJobText] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobCompany, setJobCompany] = useState("");
  const [status_, setStatus] = useState<"idle" | "parsing" | "analyzing">("idle");
  const [error, setError] = useState<string | null>(null);
  const [response, setResponse] = useState<AnalyzeResponse | null>(null);

  const busy = status_ !== "idle";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResponse(null);

    if (!file) {
      setError("Please choose a resume PDF.");
      return;
    }
    if (jobText.trim().length === 0) {
      setError("Please paste a job description.");
      return;
    }

    try {
      setStatus("parsing");
      const { parsedText, fileName } = await parseResume(file);

      setStatus("analyzing");
      const result = await analyze({
        resumeText: parsedText,
        jobText,
        resumeFileName: fileName,
        jobTitle: jobTitle || undefined,
        jobCompany: jobCompany || undefined,
      });
      setResponse(result);
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : "Something went wrong. Is the API running?",
      );
    } finally {
      setStatus("idle");
    }
  }

  if (status === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <p className="text-neutral-500">Loading…</p>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-12">
        <header className="mb-8">
          <h1 className="text-3xl font-bold">ResumeMatch</h1>
          <p className="mt-2 text-neutral-500">
            Sign in to upload your resume and analyze how well it matches a job description.
          </p>
        </header>
        <AuthButton />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-12">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Analyze a match</h1>
        <p className="text-neutral-500">
          Upload your resume and paste a job description to see how well they match.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium">Resume (PDF)</label>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm"
            disabled={busy}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            placeholder="Job title (optional)"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
          <input
            type="text"
            placeholder="Company (optional)"
            value={jobCompany}
            onChange={(e) => setJobCompany(e.target.value)}
            disabled={busy}
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">Job description</label>
          <textarea
            value={jobText}
            onChange={(e) => setJobText(e.target.value)}
            rows={10}
            placeholder="Paste the job description here…"
            disabled={busy}
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-900"
          />
        </div>

        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-white dark:text-neutral-900"
        >
          {status_ === "parsing"
            ? "Parsing resume…"
            : status_ === "analyzing"
              ? "Analyzing…"
              : "Analyze match"}
        </button>
      </form>

      {error && (
        <p className="mt-4 rounded-lg bg-red-100 px-3 py-2 text-sm text-red-800 dark:bg-red-950 dark:text-red-200">
          {error}
        </p>
      )}

      {response && (
        <div className="mt-10">
          <AnalysisView result={response.analysis} cached={response.cached} />
        </div>
      )}
    </main>
  );
}
