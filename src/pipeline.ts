// 端到端编排：query → 意图帧 → 查询计划 → 候选(数据源) → 混合排序。
// 全程与数据源、LLM 解耦，方便替换/测试/开源。

import { decompose, type DecomposeOptions } from "./intentEngine";
import { plan as buildPlan } from "./planner";
import { LocalSampleSource, type ListingSource } from "./sources";
import { rank } from "./ranking";
import type { IntentFrame, QueryPlan, ScoredListing } from "./types";

export interface SearchResult {
  frame: IntentFrame;
  plan: QueryPlan;
  results: ScoredListing[];
  candidateCount: number;
}

export interface SearchOptions extends DecomposeOptions {
  source?: ListingSource;
  topK?: number;
}

export async function search(query: string, opts: SearchOptions = {}): Promise<SearchResult> {
  const source = opts.source ?? new LocalSampleSource();
  const frame = await decompose(query, opts);
  const p = buildPlan(frame);
  const candidates = await source.search(p.hardFilters, p);
  const ranked = rank(candidates, p);
  return {
    frame,
    plan: p,
    results: ranked.slice(0, opts.topK ?? ranked.length),
    candidateCount: candidates.length,
  };
}

