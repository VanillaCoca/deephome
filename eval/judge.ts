import type { Listing } from "../src/types";
import type { GoldCase } from "./gold";

// 评委：给 (query, 某房源) 一个相关度 0..3。
export interface Judge {
  grade(caseItem: GoldCase, listing: Listing, intentSummary: string): number | Promise<number>;
}

// 金标评委：查人工分级表。默认、离线、可审计——是评测的 ground truth。
export class GoldJudge implements Judge {
  grade(c: GoldCase, l: Listing): number {
    return c.grades[l.mlsNumber] ?? 0;
  }
}

// LLM 评委（可选、可规模化）：把判断交给模型。需注入一个 complete() 适配器（如 Claude）。
// ⚠ LLM 评委有偏差(位置/冗长/自偏)且不稳定：务必先用金标集校准它，再主要看趋势/回归，别当圣旨。
export interface JudgeLLM {
  complete(prompt: string): Promise<string>;
}
export class LLMJudge implements Judge {
  constructor(private llm: JudgeLLM) {}
  async grade(c: GoldCase, l: Listing, intentSummary: string): Promise<number> {
    const prompt =
      `你是找房相关度评委。用户查询："${c.query}"。系统理解到的意图：${intentSummary}。\n` +
      `候选房源：朝向=${l.exposure ?? "?"} 楼层=${l.floor ?? "?"} 面积=${l.sqft ?? "?"} 价格=${l.price} ` +
      `描述="${(l.remarks ?? "").slice(0, 160)}"。\n` +
      `按「满足用户真实意图的程度」打分，只输出一个整数：0(不相关) 1(勉强) 2(不错) 3(理想)。`;
    const raw = await this.llm.complete(prompt);
    const m = raw.match(/[0-3]/);
    return m ? Number(m[0]) : 0;
  }
}
