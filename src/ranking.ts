// 混合排序层 —— 透明、可解释。
// 为什么坚持「透明线性融合」而不是黑盒 rerank 模型？因为 Deephome 的灵魂是「解释为什么」。
// 每一分都能拆回到「哪条意图 / 哪个属性」。真正的 cross-encoder rerank 可作为 top-K 的可选精修，
// 但绝不能取代这套可解释骨架。
//
// 四个分支互补，缺一不可：
//   structured（朝向/楼层…结构化属性） · text（remarks 关键词，BM25-lite）
//   image（图片标签 ≈ Repliers AI 图搜替身） · places（地点邻近 ≈ /places）
// 「采光好」这种潜在意图，任何单一分支都覆盖不全：朝向在结构化字段、"sun-filled" 在文本、
// 大窗在照片、而这些没有任何一个单独够用。所以混合是必需，不是装饰。

import type {
  Listing, QueryPlan, ScoredListing, Explanation, ScoreBreakdown, PlacesSignal, AnchorSignal,
} from "./types";
import { CONCEPT_BY_ID } from "./intentKB";

const STOP = new Set(["with", "and", "the", "a", "of", "from", "or", "high", "large"]);

function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat), dLng = toRad(bLng - aLng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// ---- 各分支打分（均归一到 0..1）----

function scoreStructured(l: Listing, plan: QueryPlan): { score: number; reasons: Map<string, string[]> } {
  const reasons = new Map<string, string[]>();
  if (!plan.softSignals.length) return { score: 0, reasons };
  let num = 0, den = 0;
  for (const s of plan.softSignals) {
    const raw = clamp01(s.score(l));
    const val = s.polarity === -1 ? 1 - raw : raw;
    num += s.weight * val;
    den += s.weight;
    // 解释：正向且命中较好，或反向且成功避开
    const good = s.polarity === -1 ? raw < 0.35 : raw > 0.55;
    if (good) {
      const txt = s.explain(l);
      if (txt) push(reasons, s.conceptId, txt);
    }
  }
  return { score: den ? num / den : 0, reasons };
}

function scoreText(l: Listing, plan: QueryPlan): number {
  if (!plan.textTerms.length) return 0;
  const hay = l.remarks.toLowerCase();
  let num = 0, den = 0;
  for (const t of plan.textTerms) {
    den += t.weight;
    if (hay.includes(t.term.toLowerCase())) num += t.weight;
  }
  return den ? num / den : 0;
}

function scoreImage(l: Listing, plan: QueryPlan): number {
  if (!plan.imageConcepts.length) return 0;
  const tags = l.photoTags.join(" ").toLowerCase();
  let num = 0, den = 0;
  for (const c of plan.imageConcepts) {
    const toks = c.phrase.toLowerCase().split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const hit = toks.filter((w) => tags.includes(w)).length;
    const frac = toks.length ? hit / toks.length : 0;
    num += c.weight * frac;
    den += c.weight;
  }
  return den ? num / den : 0;
}

function scorePlaces(l: Listing, plan: QueryPlan): { score: number; reasons: Map<string, string[]> } {
  const reasons = new Map<string, string[]>();
  if (!plan.placesSignals.length) return { score: 0, reasons };
  let num = 0, den = 0;
  for (const p of plan.placesSignals) {
    den += p.weight;
    const { sat, nearest, dist } = placeSat(l, p);
    num += p.weight * sat;
    if (p.want && sat > 0.5 && nearest) push(reasons, p.conceptId, `近${kindZh(p.kind)}：${nearest}（约${Math.round(dist)}m）`);
    if (!p.want && sat > 0.6) push(reasons, p.conceptId, `远离${kindZh(p.kind)}（安静）`);
    if (!p.want && sat < 0.4 && nearest) push(reasons, p.conceptId, `⚠ 紧邻${kindZh(p.kind)}：${nearest}`);
  }
  return { score: den ? num / den : 0, reasons };
}

// 邻近锚点分支：到用户指定点的距离，越近越高。
// 衰减：0m→1，halfDistM→0.5，2×halfDistM→0.33…（软性偏好，不做硬性排除）。
function scoreAnchor(l: Listing, a: AnchorSignal): { score: number; km: number } {
  const d = haversineM(l.lat, l.lng, a.lat, a.lng);
  return { score: clamp01(1 / (1 + d / a.halfDistM)), km: d / 1000 };
}

function placeSat(l: Listing, p: PlacesSignal): { sat: number; nearest: string | null; dist: number } {
  const pois = l.nearby.filter((n) => n.kind === p.kind);
  if (!pois.length) return { sat: p.want ? 0.2 : 1, nearest: null, dist: Infinity };
  let best = Infinity, name: string | null = null;
  for (const poi of pois) {
    const d = haversineM(l.lat, l.lng, poi.lat, poi.lng);
    if (d < best) { best = d; name = poi.name; }
  }
  const sat = p.want ? clamp01(1 - best / p.radiusM) : clamp01(best / p.radiusM);
  return { sat, nearest: name, dist: best };
}

// ---- 融合 ----
// 分支权重 = 该分支在计划里投入的总权重占比（计划在哪投入多，哪就更重要）。
// 结构化分支额外 ×1.2，因为它是「意图翻译」最直接的体现，也最可解释。
export function rank(candidates: Listing[], plan: QueryPlan): ScoredListing[] {
  const bw = branchWeights(plan);
  const scored = candidates.map((l) => {
    const st = scoreStructured(l, plan);
    const tx = scoreText(l, plan);
    const im = scoreImage(l, plan);
    const pl = scorePlaces(l, plan);
    const an = plan.anchor ? scoreAnchor(l, plan.anchor) : { score: 0, km: Infinity };
    const final =
      bw.structured * st.score + bw.text * tx + bw.image * im + bw.places * pl.score + bw.anchor * an.score;

    const score: ScoreBreakdown = { structured: st.score, text: tx, image: im, places: pl.score, anchor: an.score, final };
    const explanations = buildExplanations(mergeReasons(st.reasons, pl.reasons));
    // 锚点命中时，把「离 X 近」作为最靠前的解释亮出来
    if (plan.anchor && an.score > 0.15) {
      explanations.unshift({
        conceptId: "near_anchor",
        conceptLabel: `离${plan.anchor.label}近`,
        reasons: [`约 ${an.km.toFixed(1)} km`],
      });
    }
    return { listing: l, score, explanations };
  });
  return scored.sort((a, b) => b.score.final - a.score.final);
}

function branchWeights(plan: QueryPlan) {
  const raw = {
    structured: sum(plan.softSignals.map((s) => s.weight)) * 1.2,
    text: sum(plan.textTerms.map((t) => t.weight)),
    image: sum(plan.imageConcepts.map((i) => i.weight)),
    places: sum(plan.placesSignals.map((p) => p.weight)),
    anchor: plan.anchor ? plan.anchor.weight : 0, // 无锚点=0，不影响既有基线
  };
  const total = raw.structured + raw.text + raw.image + raw.places + raw.anchor || 1;
  return {
    structured: raw.structured / total,
    text: raw.text / total,
    image: raw.image / total,
    places: raw.places / total,
    anchor: raw.anchor / total,
  };
}

// ---- 小工具 ----
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
function push(m: Map<string, string[]>, k: string, v: string) {
  if (!m.has(k)) m.set(k, []);
  if (!m.get(k)!.includes(v)) m.get(k)!.push(v);
}
function mergeReasons(...maps: Map<string, string[]>[]): Map<string, string[]> {
  const out = new Map<string, string[]>();
  for (const m of maps) for (const [k, vs] of m) for (const v of vs) push(out, k, v);
  return out;
}
function buildExplanations(reasons: Map<string, string[]>): Explanation[] {
  return [...reasons.entries()].map(([conceptId, rs]) => ({
    conceptId,
    conceptLabel: CONCEPT_BY_ID[conceptId]?.labels[0] ?? conceptId,
    reasons: rs,
  }));
}
function kindZh(k: PlacesSignal["kind"]): string {
  return { transit: "地铁/公交", school: "学校", park: "公园", grocery: "超市", nightlife: "夜生活区", arterial: "主干道" }[k];
}
