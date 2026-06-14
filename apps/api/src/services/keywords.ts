/**
 * Deterministic keyword baseline. CLAUDE.md design choice #1: before calling
 * Claude, extract candidate keywords from the job description in plain code.
 * Claude then does the *semantic* matching and rewriting on top of this
 * baseline. This is classical + AI working together — keep both halves.
 *
 * Pure, dependency-free, and easy to unit test (a high-value test target).
 */

/** Common English stopwords plus boilerplate frequent in job descriptions. */
const STOPWORDS = new Set<string>([
  "a", "an", "the", "and", "or", "but", "if", "then", "else", "for", "nor",
  "so", "yet", "of", "to", "in", "on", "at", "by", "with", "from", "as",
  "is", "are", "was", "were", "be", "been", "being", "am", "do", "does",
  "did", "have", "has", "had", "having", "will", "would", "shall", "should",
  "can", "could", "may", "might", "must", "this", "that", "these", "those",
  "it", "its", "they", "them", "their", "we", "our", "you", "your", "i",
  "he", "she", "his", "her", "who", "whom", "which", "what", "where", "when",
  "why", "how", "not", "no", "out", "up", "down", "over", "under", "into",
  "about", "after", "before", "between", "through", "during", "above", "below",
  // JD boilerplate
  "experience", "work", "working", "team", "teams", "role", "roles", "ability",
  "strong", "excellent", "good", "great", "plus", "must", "required", "preferred",
  "responsibilities", "requirements", "qualifications", "years", "year", "etc",
  "including", "across", "within", "well", "looking", "join", "help", "build",
]);

/**
 * A small known-skills dictionary. Multi-word entries are matched as phrases and
 * always promoted to the top of the baseline because they're high-signal even
 * when infrequent. Extend freely — this is intentionally a starting set.
 */
const KNOWN_SKILLS: readonly string[] = [
  "typescript", "javascript", "python", "go", "golang", "rust", "java", "kotlin",
  "c++", "c#", "ruby", "php", "swift", "scala",
  "react", "next.js", "nextjs", "vue", "svelte", "angular", "node.js", "nodejs",
  "fastify", "express", "nestjs", "django", "flask", "rails", "spring",
  "postgresql", "postgres", "mysql", "mongodb", "redis", "sqlite", "prisma",
  "graphql", "rest", "grpc", "kafka", "rabbitmq",
  "docker", "kubernetes", "terraform", "ansible", "aws", "gcp", "azure",
  "ci/cd", "github actions", "gitlab", "jenkins",
  "tailwind", "css", "html", "sass",
  "vitest", "jest", "playwright", "cypress", "pytest",
  "machine learning", "deep learning", "nlp", "llm", "pytorch", "tensorflow",
];

export type KeywordCandidate = {
  keyword: string;
  /** Raw occurrence count in the job description. */
  count: number;
  /** True when matched against the known-skills dictionary. */
  known: boolean;
};

const WORD_RE = /[a-zA-Z][a-zA-Z0-9+#.]*[a-zA-Z0-9+#]|[a-zA-Z]/g;

function tokenize(text: string): string[] {
  const matches = text.toLowerCase().match(WORD_RE);
  return matches ?? [];
}

/**
 * Extract a ranked baseline of candidate keywords from the job description.
 *
 * @param jobText raw job description text
 * @param limit   max number of candidates to return (default 30)
 */
export function extractKeywords(jobText: string, limit = 30): KeywordCandidate[] {
  const lower = jobText.toLowerCase();

  // 1. Known multi-word/phrase skills found as substrings — highest signal.
  const known: KeywordCandidate[] = [];
  const knownSeen = new Set<string>();
  for (const skill of KNOWN_SKILLS) {
    if (lower.includes(skill) && !knownSeen.has(skill)) {
      const count = countOccurrences(lower, skill);
      known.push({ keyword: skill, count, known: true });
      knownSeen.add(skill);
    }
  }

  // 2. Frequency-ranked single-word candidates, minus stopwords and anything
  //    already captured by the known-skills pass.
  const freq = new Map<string, number>();
  for (const token of tokenize(jobText)) {
    if (token.length < 3) continue;
    if (STOPWORDS.has(token)) continue;
    if (knownSeen.has(token)) continue;
    freq.set(token, (freq.get(token) ?? 0) + 1);
  }

  const frequencyRanked: KeywordCandidate[] = [...freq.entries()]
    .map(([keyword, count]) => ({ keyword, count, known: false }))
    .sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));

  // Known skills first (sorted by count), then frequency-ranked fillers.
  known.sort((a, b) => b.count - a.count || a.keyword.localeCompare(b.keyword));

  return [...known, ...frequencyRanked].slice(0, limit);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = haystack.indexOf(needle);
  while (idx !== -1) {
    count += 1;
    idx = haystack.indexOf(needle, idx + needle.length);
  }
  return count;
}
