// Layer 0 · 富化管线（Enrichment Pipeline）
// ---------------------------------------------------------------------------
// 为什么这是「最关键」的一层：意图引擎能按「朝向 / 楼层 / 开窗比例 / 层高」排序，
// 前提是这些字段【存在】。但真实 MLS 只稳定给一部分（exposure/floorNum 有时有），
// 像「开窗比例」「层高」「是否可养宠」这些用户真正在意的，MLS 根本没有——
// 必须从 remarks 自由文本 + 照片 派生出来。这层就是把「原始 MLS」变成「可意图化的房源」。
//
// 设计原则（延续产品的可解释基因）：每个派生字段都带 **来源 + 置信度**（provenance）。
// 低置信度的富化在排序里应当权重更低、并可被更强的信号（视觉模型）覆盖。
//
// 两类抽取器：
//   ① 确定性文本抽取（正则/关键词）——便宜、可审计、现在就能离线跑（本文件已实现）。
//   ② 模型抽取（视觉/LLM）——更强，做成可插拔接口（VisionAdapter），生产接 Repliers Image Insights。

import type { Listing, Exposure, Poi } from "./types";

// 原始 MLS 形状：只有 MLS 真会给的东西 + 自由文本 + （可选）图片标签。
export interface RawListing {
  mlsNumber: string;
  type: "sale" | "lease";
  propertyType: string;
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;
  parking?: number;
  rawExposure?: string | null; // MLS 可能给，如 "South" / "Sw" / null
  rawFloor?: number | null;    // MLS floorNum
  rawStoreys?: number | null;  // MLS numStoreys
  remarks: string;             // 自由文本（富化主战场）
  photoTags?: string[];        // 图片洞察标签（无则空）
  nearby?: Poi[];              // /places（无则空）
}

export type Provenance = "mls" | "remarks" | "photos" | "inferred" | "default";
export interface FieldTrace {
  value: unknown;
  source: Provenance;
  confidence: number; // 0..1
  note?: string;
}
export type EnrichReport = Record<string, FieldTrace>;

// 生产可注入：从照片估计开窗比例 / 补充标签（如 Repliers Image Insights）。
export interface VisionAdapter {
  analyze(photoRefs: string[]): Promise<{ windowExposurePct?: number; tags?: string[] }>;
}

// ---------------- 各字段抽取器 ----------------

const DIRS: Record<string, Exposure> = {
  n: "N", s: "S", e: "E", w: "W", ne: "NE", nw: "NW", se: "SE", sw: "SW",
};

// 朝向：先用 MLS 原值，否则从 remarks 推断（"south-facing" / "faces south" / "朝南"）。
function extractExposure(raw: RawListing): FieldTrace {
  const clean = (raw.rawExposure ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (clean && DIRS[clean]) return { value: DIRS[clean], source: "mls", confidence: 0.95 };
  const combined = combineDir(raw.rawExposure ?? "");
  if (combined) return { value: combined, source: "mls", confidence: 0.9 };
  const t = raw.remarks.toLowerCase();
  const fromText =
    /(south[- ]?west|朝西南|southwest)/.test(t) ? "SW" :
    /(south[- ]?east|朝东南|southeast)/.test(t) ? "SE" :
    /(north[- ]?west|northwest)/.test(t) ? "NW" :
    /(north[- ]?east|northeast)/.test(t) ? "NE" :
    /(south[- ]?facing|faces? (the )?south|southern exposure|朝南|南向)/.test(t) ? "S" :
    /(north[- ]?facing|faces? (the )?north|朝北)/.test(t) ? "N" :
    /(west[- ]?facing|faces? (the )?west|朝西|sunset)/.test(t) ? "W" :
    /(east[- ]?facing|faces? (the )?east|朝东|sunrise)/.test(t) ? "E" : null;
  if (fromText) return { value: fromText as Exposure, source: "remarks", confidence: 0.6, note: "从文本推断朝向" };
  return { value: null, source: "default", confidence: 0.2 };
}

function combineDir(s: string): Exposure | null {
  const t = s.toLowerCase();
  const ns = /north/.test(t) ? "N" : /south/.test(t) ? "S" : "";
  const ew = /east/.test(t) ? "E" : /west/.test(t) ? "W" : "";
  const k = (ns + ew).toLowerCase();
  return k && DIRS[k] ? DIRS[k] : null;
}

// 开窗比例（采光代理）：MLS 没有，从窗户措辞 + 角户 推断；视觉模型可覆盖。
function extractWindowPct(raw: RawListing): FieldTrace {
  const t = (raw.remarks + " " + (raw.photoTags ?? []).join(" ")).toLowerCase();
  let value = 0.45, source: Provenance = "default", confidence = 0.3, note: string | undefined;
  if (/floor[- ]?to[- ]?ceiling|wall(s)? of (window|glass)|walls of glass/.test(t)) {
    value = 0.85; source = "remarks"; confidence = 0.65; note = "落地窗/整面玻璃";
  } else if (/(big|large|oversized|expansive|huge) windows/.test(t)) {
    value = 0.7; source = "remarks"; confidence = 0.55; note = "大窗措辞";
  } else if (/(sun-?filled|sun-?drenched|lots of (natural )?light|flooded with light|bright)/.test(t)) {
    value = 0.6; source = "remarks"; confidence = 0.45; note = "明亮措辞（弱信号）";
  }
  if (/corner (unit|suite)/.test(t)) { value = Math.min(1, value + 0.1); note = (note ? note + " + " : "") + "角户"; }
  return { value: round2(value), source, confidence, note };
}

// 层高：从 remarks 抓 "10ft ceilings" / "9 foot ceilings" / "10' ceilings"。
function extractCeiling(raw: RawListing): FieldTrace {
  const m = raw.remarks.match(/(\d{1,2}(?:\.\d)?)\s*(?:ft|foot|feet|['’])\s*ceiling/i) ||
            raw.remarks.match(/ceilings?\s*(?:of\s*)?(\d{1,2}(?:\.\d)?)\s*(?:ft|foot|feet|['’])/i);
  if (m) return { value: parseFloat(m[1]), source: "remarks", confidence: 0.8, note: `匹配「${m[0].trim()}」` };
  return { value: null, source: "default", confidence: 0.2 };
}

// 楼层：MLS floorNum 优先，否则 remarks（"18th floor" / penthouse）。
function extractFloor(raw: RawListing): FieldTrace {
  if (raw.rawFloor != null) return { value: raw.rawFloor, source: "mls", confidence: 0.95 };
  const m = raw.remarks.match(/(\d{1,3})(?:st|nd|rd|th)\s*floor/i);
  if (m) return { value: parseInt(m[1], 10), source: "remarks", confidence: 0.7, note: `匹配「${m[0].trim()}」` };
  if (/penthouse|\bph\b/i.test(raw.remarks) && raw.rawStoreys) return { value: raw.rawStoreys, source: "inferred", confidence: 0.6, note: "penthouse→顶层" };
  return { value: null, source: "default", confidence: 0.2 };
}

// 可养宠：remarks 正/负向措辞。
function extractPets(raw: RawListing): FieldTrace {
  const t = raw.remarks.toLowerCase();
  if (/\bno pets?\b|pets?\s+not\s+(allowed|permitted)|not pet friendly/.test(t)) return { value: false, source: "remarks", confidence: 0.8, note: "明确不允许" };
  if (/pet[- ]?friendly|pets?\s+(are\s+)?(allowed|welcome|ok|permitted)|allows? pets?/.test(t)) return { value: true, source: "remarks", confidence: 0.75 };
  return { value: null, source: "default", confidence: 0.2 };
}

// 阳台类型：enclosed→encl，其余提到 balcony/terrace→open。
function extractBalcony(raw: RawListing): FieldTrace {
  const t = raw.remarks.toLowerCase();
  if (/enclosed balcony|encl\.? balcony/.test(t)) return { value: "encl", source: "remarks", confidence: 0.7 };
  if (/balcony|terrace|juliet/.test(t)) return { value: "open", source: "remarks", confidence: 0.6 };
  return { value: null, source: "default", confidence: 0.2 };
}

// ---------------- 主入口 ----------------
export interface EnrichOptions {
  vision?: VisionAdapter;
  visionRefs?: (raw: RawListing) => string[]; // 如何取该房源的图片引用
}

export async function enrich(raw: RawListing, opts: EnrichOptions = {}): Promise<{ listing: Listing; report: EnrichReport }> {
  const exposure = extractExposure(raw);
  const floor = extractFloor(raw);
  let windowPct = extractWindowPct(raw);
  const ceiling = extractCeiling(raw);
  const pets = extractPets(raw);
  const balcony = extractBalcony(raw);

  // 视觉模型（若注入）覆盖开窗比例——更高置信度。
  if (opts.vision) {
    const refs = opts.visionRefs ? opts.visionRefs(raw) : [];
    const v = await opts.vision.analyze(refs);
    if (typeof v.windowExposurePct === "number") {
      windowPct = { value: round2(v.windowExposurePct), source: "photos", confidence: 0.85, note: "视觉模型估计" };
    }
  }

  const listing: Listing = {
    mlsNumber: raw.mlsNumber,
    type: raw.type,
    propertyType: raw.propertyType,
    city: raw.city,
    neighborhood: raw.neighborhood,
    lat: raw.lat,
    lng: raw.lng,
    price: raw.price,
    beds: raw.beds,
    baths: raw.baths,
    sqft: raw.sqft,
    exposure: exposure.value as Exposure,
    floor: floor.value as number | null,
    storeys: raw.rawStoreys ?? null,
    ceilingHeightFt: ceiling.value as number | null,
    windowExposurePct: windowPct.value as number | null,
    balcony: balcony.value as string | null,
    parking: raw.parking ?? 0,
    petsAllowed: pets.value as boolean | null,
    remarks: raw.remarks,
    photoTags: raw.photoTags ?? [],
    nearby: raw.nearby ?? [],
  };

  const report: EnrichReport = {
    exposure, floor, storeys: { value: raw.rawStoreys ?? null, source: raw.rawStoreys != null ? "mls" : "default", confidence: raw.rawStoreys != null ? 0.95 : 0.2 },
    ceilingHeightFt: ceiling, windowExposurePct: windowPct, petsAllowed: pets, balcony,
  };
  return { listing, report };
}

export async function enrichAll(raws: RawListing[], opts: EnrichOptions = {}): Promise<Listing[]> {
  return Promise.all(raws.map(async (r) => (await enrich(r, opts)).listing));
}

const round2 = (x: number) => Math.round(x * 100) / 100;
