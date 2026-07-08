// 意图 → 属性 规划层。
// 把 IntentFrame 展开成一个可执行的 QueryPlan：硬过滤 + 加权软信号 + 文本词 + 图搜概念 + 地点信号。
// 这一层是「翻译」：用户从没提过「朝向」，但因为他要「采光好」，我们就把朝向加进了排序依据。

import type {
  IntentFrame, QueryPlan, SoftSignal, TextTerm, ImageConcept, PlacesSignal, LiteralConstraints,
} from "./types";
import { CONCEPT_BY_ID } from "./intentKB";

export function plan(frame: IntentFrame): QueryPlan {
  const hardFilters: LiteralConstraints = {};
  const softSignals: SoftSignal[] = [];
  const textTerms: TextTerm[] = [];
  const imageConcepts: ImageConcept[] = [];
  const placesSignals: PlacesSignal[] = [];
  const summaryParts: string[] = [];

  for (const item of frame.items) {
    if (item.kind === "literal" && item.literal) {
      Object.assign(hardFilters, item.literal);
      continue;
    }
    if (item.kind === "novel") {
      // 未知需求：原样丢给文本 + 图搜分支（保底召回）。
      textTerms.push({ term: item.surface, weight: 0.6 * item.weight, conceptId: "novel" });
      imageConcepts.push({ phrase: item.surface, weight: 0.5 * item.weight, conceptId: "novel" });
      continue;
    }
    if (item.kind !== "intent" || !item.conceptId) continue;
    const c = CONCEPT_BY_ID[item.conceptId];
    if (!c) continue;

    const w = item.weight;

    // 用户明确「必须」且概念定义了硬约束 → 升级为硬过滤
    if (item.hardness === "hard" && c.hard) Object.assign(hardFilters, c.hard);

    for (const s of c.soft ?? []) {
      softSignals.push({
        id: s.id,
        conceptId: c.id,
        label: s.label,
        weight: s.weight * w,
        polarity: item.polarity,
        score: s.score,
        explain: s.explain,
      });
    }
    for (const t of c.text ?? []) textTerms.push({ term: t.term, weight: t.weight * w, conceptId: c.id });
    for (const im of c.image ?? []) imageConcepts.push({ phrase: im.phrase, weight: im.weight * w, conceptId: c.id });
    for (const p of c.places ?? [])
      placesSignals.push({ conceptId: c.id, kind: p.kind, want: p.want, weight: p.weight * w, radiusM: p.radiusM });

    const verb = item.polarity === -1 ? "避免" : "想要";
    summaryParts.push(`${verb}「${c.labels[0]}」${item.note ? `(${item.note})` : ""}`);
  }

  const summary =
    (summaryParts.length ? `理解到你${summaryParts.join("、")}。` : "未识别到潜在意图。") +
    (softSignals.length ? ` 将按 ${uniqueLabels(softSignals).join(" / ")} 等属性排序。` : "");

  return { hardFilters, softSignals, textTerms, imageConcepts, placesSignals, intentSummary: summary };
}

function uniqueLabels(signals: SoftSignal[]): string[] {
  return [...new Set(signals.map((s) => s.label))];
}
