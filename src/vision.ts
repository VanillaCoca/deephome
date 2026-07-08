// 视觉抽取器：让「开窗比例」从【照片】来，而不是从措辞猜。
// ---------------------------------------------------------------------------
// 为什么重要：措辞会骗人——房源文案写 "big windows" 但照片其实是普通窗；或文案只字未提
// 但照片是整面落地窗。措辞派生只能算「弱先验」，照片才是事实。VisionAdapter 就是把这块
// 交给真实视觉信号，并以更高置信度【覆盖】措辞猜测（见 enrich.ts 的覆盖逻辑）。
//
// Repliers 路径用的是官方 **AI Image Search**（免费 Preview 档即可）：
//   POST /listings?mlsNumber=<mls>  body: { imageSearchItems:[{type:"text",value:"...",boost:1}] }
//   返回该房源一个 score —— 单个概念时满分=1.0，即「该概念在这套房照片里的显著度」。
//   我们用「落地窗/大窗」概念的 score 作为 windowExposurePct 的照片派生值。
// 说明：这是相关度分数（照片里窗户越显著→越高），是比措辞强得多的信号；若要更精确的
//   「玻璃面积占比」，可上 Advanced 档的 Photo Insights（对象检测/字幕）——接口不变。

import type { RawListing, VisionAdapter } from "./enrich";

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round2 = (x: number) => Math.round(x * 100) / 100;

// ---------------- 真实 Repliers 适配器（需 API key；未在离线 demo 执行）----------------
export interface RepliersVisionOptions {
  apiKey: string;
  base?: string;
  // 用来探测「窗户显著度」的视觉概念（单概念便于把 score 直接当 0..1）。
  windowConcept?: string;
}

export class RepliersVisionAdapter implements VisionAdapter {
  private base: string;
  private concept: string;
  constructor(private opts: RepliersVisionOptions) {
    this.base = opts.base ?? "https://api.repliers.io";
    this.concept = opts.windowConcept ?? "large floor-to-ceiling windows with abundant natural light";
  }

  async analyze(raw: RawListing): Promise<{ windowExposurePct?: number; tags?: string[]; note?: string }> {
    const body = { imageSearchItems: [{ type: "text", value: this.concept, boost: 1 }] };
    const res = await fetch(`${this.base}/listings?mlsNumber=${encodeURIComponent(raw.mlsNumber)}&status=A`, {
      method: "POST",
      headers: { "REPLIERS-API-KEY": this.opts.apiKey, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Repliers image search ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    const l = (json.listings ?? [])[0];
    if (!l || typeof l.score !== "number") return {}; // 无照片/无分 → 不覆盖，保留措辞猜测
    // 单概念满分=1.0，直接当窗户显著度。
    const pct = clamp01(l.score);
    return { windowExposurePct: round2(pct), note: `Repliers 图搜 score=${l.score.toFixed(3)}` };
  }

  // 生产建议：一次 image-search 打分整个候选集，而非逐套调用。
  // 做法：POST /listings?<候选过滤> + 同样的 imageSearchItems，遍历返回的 listings 读各自 score。
  async analyzeMany(raws: RawListing[]): Promise<Record<string, { windowExposurePct: number }>> {
    const out: Record<string, { windowExposurePct: number }> = {};
    for (const r of raws) {
      const v = await this.analyze(r);
      if (typeof v.windowExposurePct === "number") out[r.mlsNumber] = { windowExposurePct: v.windowExposurePct };
    }
    return out;
  }
}

// ---------------- 离线 Mock 适配器（用于 demo / 测试）----------------
// 用一张「照片其实长什么样」的表来模拟视觉模型的输出，好演示「照片覆盖措辞」的效果
// （包括照片与文案【不一致】时，以照片为准）。
export class MockVisionAdapter implements VisionAdapter {
  constructor(private photoWindowScore: Record<string, number>) {}
  async analyze(raw: RawListing): Promise<{ windowExposurePct?: number; tags?: string[]; note?: string }> {
    const s = this.photoWindowScore[raw.mlsNumber];
    if (typeof s !== "number") return {};
    return { windowExposurePct: round2(clamp01(s)), note: `模拟照片视觉 score=${s.toFixed(2)}` };
  }
}
