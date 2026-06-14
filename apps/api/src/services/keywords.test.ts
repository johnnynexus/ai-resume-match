import { describe, it, expect } from "vitest";
import { extractKeywords } from "./keywords.js";

describe("extractKeywords", () => {
  it("surfaces known multi-word skills as high-signal candidates", () => {
    const jd = "We need someone strong in Next.js and machine learning to join the team.";
    const result = extractKeywords(jd);
    const keywords = result.map((k) => k.keyword);
    expect(keywords).toContain("next.js");
    expect(keywords).toContain("machine learning");
    // Known skills are flagged.
    expect(result.find((k) => k.keyword === "next.js")?.known).toBe(true);
  });

  it("ranks known skills ahead of generic frequency-ranked words", () => {
    const jd =
      "Backend role. You will design APIs. APIs APIs APIs. Must know PostgreSQL and Docker.";
    const result = extractKeywords(jd);
    const knownIndex = result.findIndex((k) => k.known);
    const firstUnknownIndex = result.findIndex((k) => !k.known);
    expect(knownIndex).toBeGreaterThanOrEqual(0);
    if (firstUnknownIndex !== -1) {
      expect(knownIndex).toBeLessThan(firstUnknownIndex);
    }
  });

  it("filters out stopwords and JD boilerplate", () => {
    const jd = "The ideal candidate has experience and the ability to work with the team.";
    const keywords = extractKeywords(jd).map((k) => k.keyword);
    for (const noise of ["the", "and", "experience", "ability", "work", "team", "with"]) {
      expect(keywords).not.toContain(noise);
    }
  });

  it("counts occurrences and ranks by frequency", () => {
    const jd = "kafka kafka kafka redis redis sqlite";
    const result = extractKeywords(jd);
    const kafka = result.find((k) => k.keyword === "kafka");
    const redis = result.find((k) => k.keyword === "redis");
    expect(kafka?.count).toBe(3);
    expect(redis?.count).toBe(2);
    // kafka (3) should rank ahead of redis (2)
    const kafkaIdx = result.findIndex((k) => k.keyword === "kafka");
    const redisIdx = result.findIndex((k) => k.keyword === "redis");
    expect(kafkaIdx).toBeLessThan(redisIdx);
  });

  it("respects the limit", () => {
    const jd = Array.from({ length: 100 }, (_, i) => `term${i}`).join(" ");
    expect(extractKeywords(jd, 10)).toHaveLength(10);
  });

  it("returns an empty array for empty input", () => {
    expect(extractKeywords("")).toEqual([]);
  });

  it("is deterministic for equal-frequency words (stable tiebreak)", () => {
    const jd = "alpha bravo charlie";
    const a = extractKeywords(jd).map((k) => k.keyword);
    const b = extractKeywords(jd).map((k) => k.keyword);
    expect(a).toEqual(b);
  });
});
