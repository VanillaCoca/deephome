// LLM 适配器接口 —— 生产环境的意图理解前端。
// 我们把「调用哪个模型」抽象掉：可以接 Claude、OpenAI，或 Repliers /nlp。
// 关键设计：LLM 只做「模糊映射」——把用户的自由文本对齐到 KB 里已知的概念 id +
// 抽取字面约束 + 判断否定/软硬/歧义。它【不】自由发明「意图→属性」的映射，
// 那部分永远由 KB 决定。这样既拿到 LLM 的语言灵活性，又不牺牲可审计性。

import type { IntentFrame } from "./types";
import { CONCEPTS } from "./intentKB";

export interface LLMAdapter {
  // 输入 prompt，返回模型的原始文本（应为 JSON）。由调用方注入具体实现。
  complete(prompt: string): Promise<string>;
}

// 构造给 LLM 的 prompt：把 KB 概念词表塞进去做 grounding。
export function buildDecompositionPrompt(query: string, context?: string): string {
  const catalog = CONCEPTS.map(
    (c) => `- ${c.id} (${c.labels[0]}): ${c.gloss}\n    线索词: ${c.surfaceCues.slice(0, 8).join(", ")}`,
  ).join("\n");

  return `你是 Deephome 的意图理解器。把用户的找房自然语言拆解成结构化「意图帧」。

可用意图概念（只能从这些 id 里选；命中不了就标 novel）：
${catalog}

规则：
1. 把 city / 卧室数 / 预算 / 租或买 / 房型 这类【字面约束】抽成 kind="literal"。
2. 把「潜在需求」映射到上面的概念 id，kind="intent"。注意用户的字面词往往只是代理，
   例如「大窗户」通常真实意图是 good_light（也可能是 view / spacious，若歧义请在 clarifications 里给出）。
3. 判断 polarity（想要=1 / 想避免=-1）、hardness（"必须/一定要"=hard，否则 soft）、
   weight（强调程度 0..1）、confidence（0..1）。
4. 匹配不到任何概念的重要短语，标 kind="novel"，surface 保留原短语（后续走语义/图搜）。
5. 只输出 JSON，结构：
{"items":[{"surface","kind","conceptId?","literal?","polarity","hardness","weight","confidence"}],
 "clarifications":[{"itemSurface","question","options":[{"label","conceptId"}]}]}

${context ? `对话上下文:\n${context}\n` : ""}用户输入: """${query}"""
只输出 JSON：`;
}

// 解析 LLM 返回的 JSON 成 IntentFrame（容错：抽取第一个 JSON 对象）。
export function parseFrame(raw: string, rawQuery: string): IntentFrame {
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("LLM 未返回可解析的 JSON");
  const obj = JSON.parse(match[0]);
  return {
    rawQuery,
    items: (obj.items ?? []).map((i: any) => ({
      surface: i.surface ?? "",
      kind: i.kind ?? "novel",
      conceptId: i.conceptId,
      literal: i.literal,
      polarity: i.polarity === -1 ? -1 : 1,
      hardness: i.hardness === "hard" ? "hard" : "soft",
      weight: typeof i.weight === "number" ? i.weight : 0.6,
      confidence: typeof i.confidence === "number" ? i.confidence : 0.6,
      note: i.note,
    })),
    clarifications: obj.clarifications ?? [],
  };
}
