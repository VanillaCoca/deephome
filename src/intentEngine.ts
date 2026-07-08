// 意图理解层。
//   - 有 LLM 时：走 llm.ts 的 grounded 分解（生产路径，处理新说法/否定/上下文最好）。
//   - 无 LLM 时：确定性回退——基于 KB 线索词的匹配 + 轻量字面解析。
//     回退版本已足够跑通 demo，也可作为「无网/离线/兜底」路径长期保留。

import type { IntentFrame, IntentItem, LiteralConstraints, Clarification } from "./types";
import { CONCEPTS } from "./intentKB";
import { type LLMAdapter, buildDecompositionPrompt, parseFrame } from "./llm";

// 多伦多小型地名表（demo 用；生产用 Repliers /locations autocomplete）。
const CITIES = ["toronto", "north york", "scarborough", "etobicoke", "mississauga", "markham"];
const NEIGHBORHOODS = ["annex", "liberty village", "yorkville", "leslieville", "the beaches", "distillery", "king west", "midtown"];

const EMPHASIS = ["很", "非常", "特别", "一定", "务必", "超", "really", "very", "must"];
const HARD_CUES = ["必须", "一定要", "务必", "只要", "must", "need to", "required"];
const NEG_CUES = ["不要", "别", "避免", "讨厌", "no ", "not ", "avoid", "without"];

function parseLiterals(q: string): IntentItem[] {
  const items: IntentItem[] = [];
  const lower = q.toLowerCase();
  const lit: LiteralConstraints = {};

  for (const c of CITIES) if (lower.includes(c)) lit.city = title(c);
  for (const n of NEIGHBORHOODS) if (lower.includes(n)) lit.neighborhood = title(n);

  // 卧室数：支持 "2 bed" / "两房" / "3卧"
  const bed = lower.match(/(\d+)\s*(?:\+)?\s*(?:bed|bd|bedroom|房|卧|居)/);
  if (bed) lit.minBeds = parseInt(bed[1], 10);
  const zhBed = q.match(/([一二三四五])\s*(?:房|卧|居室)/);
  if (zhBed && !bed) lit.minBeds = "一二三四五".indexOf(zhBed[1]) + 1;

  // 预算： "800k" / "under 900000" / "80万"
  const k = lower.match(/(\d+(?:\.\d+)?)\s*k\b/);
  if (k) lit.maxPrice = Math.round(parseFloat(k[1]) * 1000);
  const wan = q.match(/(\d+(?:\.\d+)?)\s*万/);
  if (wan) lit.maxPrice = Math.round(parseFloat(wan[1]) * 10000);
  const under = lower.match(/(?:under|below|<|最多|不超过)\s*\$?\s*(\d{5,7})/);
  if (under) lit.maxPrice = parseInt(under[1], 10);

  // 租/买
  if (/(rent|lease|租|出租)/.test(lower)) lit.type = "lease";
  else if (/(buy|purchase|sale|买|购)/.test(lower)) lit.type = "sale";

  // 房型
  if (/(condo|公寓|apartment)/.test(lower)) lit.propertyType = "Condo Apt";
  else if (/(detached|独立屋)/.test(lower)) lit.propertyType = "Detached";
  else if (/(town|镇屋|联排)/.test(lower)) lit.propertyType = "Townhouse";

  if (Object.keys(lit).length) {
    items.push({ surface: "字面约束", kind: "literal", literal: lit, polarity: 1, hardness: "hard", weight: 1, confidence: 0.9 });
  }
  return items;
}

function title(s: string) {
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

// 确定性意图匹配：扫描 KB 线索词。
function matchConcepts(q: string): { items: IntentItem[]; clarifications: Clarification[] } {
  const lower = q.toLowerCase();
  const items: IntentItem[] = [];
  const clarifications: Clarification[] = [];
  const seen = new Set<string>();

  const emphasis = EMPHASIS.some((e) => lower.includes(e.toLowerCase())) ? 0.9 : 0.65;

  for (const c of CONCEPTS) {
    const cueHit = c.surfaceCues.find((cue) => lower.includes(cue.toLowerCase()));
    const ambigHit = (c.ambiguousCues ?? []).find((cue) => lower.includes(cue.toLowerCase()));
    const hit = cueHit ?? ambigHit;
    if (!hit || seen.has(c.id)) continue;
    seen.add(c.id);

    // 否定检测：线索词前 6 个字符内出现否定词 → polarity -1
    const idx = lower.indexOf(hit.toLowerCase());
    const before = lower.slice(Math.max(0, idx - 6), idx);
    const polarity = NEG_CUES.some((n) => before.includes(n.trim())) ? -1 : 1;
    const hardness = HARD_CUES.some((h) => lower.includes(h.toLowerCase())) ? "hard" : "soft";

    items.push({
      surface: hit,
      kind: "intent",
      conceptId: c.id,
      polarity,
      hardness,
      weight: emphasis,
      confidence: ambigHit && !cueHit ? 0.55 : 0.8,
      note: ambigHit && !cueHit ? "由模糊入口推断" : undefined,
    });

    // 命中模糊入口 → 触发澄清
    if (ambigHit && !cueHit && c.clarify) {
      clarifications.push({ itemSurface: ambigHit, question: c.clarify.question, options: c.clarify.options });
    }
  }
  return { items, clarifications };
}

export interface DecomposeOptions {
  llm?: LLMAdapter;
  context?: string;
}

export async function decompose(query: string, opts: DecomposeOptions = {}): Promise<IntentFrame> {
  if (opts.llm) {
    const raw = await opts.llm.complete(buildDecompositionPrompt(query, opts.context));
    return parseFrame(raw, query);
  }
  // —— 确定性回退 ——
  const literals = parseLiterals(query);
  const { items, clarifications } = matchConcepts(query);
  return { rawQuery: query, items: [...literals, ...items], clarifications };
}
