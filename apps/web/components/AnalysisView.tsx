import type { AnalysisResult } from "@resumematch/shared";

const severityColor: Record<"high" | "medium" | "low", string> = {
  high: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200",
  medium: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  low: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

function Badge({ level }: { level: "high" | "medium" | "low" }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${severityColor[level]}`}>
      {level}
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function AnalysisView({ result, cached }: { result: AnalysisResult; cached: boolean }) {
  return (
    <div className="space-y-8">
      {/* Score */}
      <div className="flex items-baseline gap-4">
        <div className="text-5xl font-bold tabular-nums">{result.overall_match_score}</div>
        <div className="text-neutral-500">/ 100 overall match</div>
        {cached && (
          <span className="ml-auto rounded bg-blue-100 px-2 py-1 text-xs text-blue-800 dark:bg-blue-950 dark:text-blue-200">
            cached
          </span>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3 text-center text-sm">
        {(
          [
            ["Skills", result.score_breakdown.skills_match],
            ["Experience", result.score_breakdown.experience_match],
            ["Keywords", result.score_breakdown.keyword_coverage],
          ] as const
        ).map(([label, value]) => (
          <div key={label} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
            <div className="text-2xl font-semibold tabular-nums">{value}</div>
            <div className="text-neutral-500">{label}</div>
          </div>
        ))}
      </div>

      <p className="text-neutral-700 dark:text-neutral-300">{result.summary}</p>

      <Section title="Matched skills">
        <ul className="space-y-2">
          {result.matched_skills.map((s, i) => (
            <li key={i} className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <span className="font-medium">{s.skill}</span>
              <p className="text-sm text-neutral-500">{s.evidence}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Missing keywords">
        <ul className="space-y-2">
          {result.missing_keywords.map((k, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <Badge level={k.importance} />
              <div>
                <span className="font-medium">{k.keyword}</span>
                <p className="text-sm text-neutral-500">{k.where_to_add}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Section feedback">
        <ul className="space-y-2">
          {result.section_feedback.map((f, i) => (
            <li key={i} className="flex items-start gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <Badge level={f.severity} />
              <div>
                <span className="font-medium">{f.section}</span>
                <p className="text-sm text-neutral-500">{f.feedback}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Rewrite suggestions — the headline feature, rendered as before/after. */}
      <Section title="Rewrite suggestions">
        <ul className="space-y-4">
          {result.rewrite_suggestions.map((r, i) => (
            <li key={i} className="space-y-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
              <div className="rounded bg-red-50 p-2 text-sm line-through decoration-red-400 dark:bg-red-950/40">
                {r.original}
              </div>
              <div className="rounded bg-green-50 p-2 text-sm dark:bg-green-950/40">{r.improved}</div>
              <p className="text-xs text-neutral-500">{r.reason}</p>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}
