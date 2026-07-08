import { search } from "../src/pipeline";
import type { ListingSource } from "../src/sources";
import { GOLD } from "./gold";
import { GoldJudge, type Judge } from "./judge";
import { ndcgAtK, mean } from "./metrics";

export interface CaseResult {
  id: string;
  query: string;
  ndcg: number;
  top: { mls: string; grade: number }[];
}
export interface SuiteResult {
  cases: CaseResult[];
  meanNdcg: number;
  k: number;
}

export async function runEval(opts: { judge?: Judge; source?: ListingSource; k?: number } = {}): Promise<SuiteResult> {
  const judge = opts.judge ?? new GoldJudge();
  const k = opts.k ?? 5;
  const cases: CaseResult[] = [];
  for (const c of GOLD) {
    const r = await search(c.query, { source: opts.source, topK: k });
    const rankedGrades: number[] = [];
    const top: { mls: string; grade: number }[] = [];
    for (const res of r.results) {
      const g = await judge.grade(c, res.listing, r.plan.intentSummary);
      rankedGrades.push(g);
      top.push({ mls: res.listing.mlsNumber, grade: g });
    }
    cases.push({ id: c.id, query: c.query, ndcg: ndcgAtK(rankedGrades, Object.values(c.grades), k), top });
  }
  return { cases, meanNdcg: mean(cases.map((c) => c.ndcg)), k };
}
