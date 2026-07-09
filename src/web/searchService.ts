// 网页搜索服务（框架无关）。合并「Header 结构化 filter」与「意图输入框自由文本」，
// 跑 Deephome 意图引擎，返回给前端用的干净 JSON。Next.js 的 /api/search 只是薄封装。
import { decompose } from "../intentEngine";
import { plan as buildPlan } from "../planner";
import { LocalSampleSource, RepliersSource, type ListingSource } from "../sources";
import { rank } from "../ranking";
import type { LiteralConstraints, Listing, ScoredListing } from "../types";

export type SourceKind = "sample" | "repliers";

export interface WebFilters {
  type?: "sale" | "lease";
  city?: string;
  neighborhood?: string;
  propertyType?: string;
  minBeds?: number;
  minBaths?: number;
  minPrice?: number;
  maxPrice?: number;
  minParking?: number;
}

export interface WebReason { concept: string; points: string[]; }
export interface WebListing {
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
  exposure: string | null;
  floor: number | null;
  score: number;
  reasons: WebReason[];
  images: string[];
}
export interface WebIntent {
  summary: string;
  items: { surface: string; concept?: string; kind: string }[];
  clarifications: { itemSurface: string; question: string; options: { label: string; conceptId: string }[] }[];
}
export interface WebSearchResult {
  intent: WebIntent;
  count: number;
  results: WebListing[];
  source: SourceKind;
  filters: WebFilters; // 合并后的硬约束，供舞台 header 展示为 chips
}

export interface RunSearchInput {
  filters?: WebFilters;
  intent?: string;
  source?: SourceKind;
  apiKey?: string; // repliers 时用；由服务端注入，绝不来自浏览器
  topK?: number;
}

export async function runSearch(input: RunSearchInput): Promise<WebSearchResult> {
  const filters = input.filters ?? {};
  const intentText = (input.intent ?? "").trim();
  const topK = input.topK ?? 24;
  const sourceKind: SourceKind = input.source === "repliers" ? "repliers" : "sample";

  // 1) 意图理解（仅针对自由文本）
  const frame = await decompose(intentText);
  const p = buildPlan(frame);

  // 2) 合并硬约束：Header 的结构化 filter 覆盖意图里解析出的 literal
  const hard: LiteralConstraints = { ...p.hardFilters };
  (Object.keys(filters) as (keyof WebFilters)[]).forEach((k) => {
    const v = filters[k];
    if (v !== undefined && v !== null && (v as unknown) !== "") (hard as any)[k] = v;
  });
  p.hardFilters = hard;

  // 3) 数据源（sample 默认；repliers 需 apiKey，由服务端注入）
  const source: ListingSource =
    sourceKind === "repliers" ? new RepliersSource(input.apiKey ?? "") : new LocalSampleSource();

  const candidates = await source.search(hard, p);
  const ranked = rank(candidates, p).slice(0, topK);

  return {
    intent: {
      summary: p.intentSummary,
      items: frame.items
        .filter((i: any) => i.kind !== "literal")
        .map((i: any) => ({ surface: i.surface, concept: i.conceptId, kind: i.kind })),
      clarifications: frame.clarifications,
    },
    count: candidates.length,
    results: ranked.map(toWebListing),
    source: sourceKind,
    filters: hard as WebFilters,
  };
}

function toWebListing(r: ScoredListing): WebListing {
  const l = r.listing;
  return {
    mlsNumber: l.mlsNumber,
    type: l.type,
    propertyType: l.propertyType,
    city: l.city,
    neighborhood: l.neighborhood,
    lat: l.lat,
    lng: l.lng,
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    exposure: l.exposure,
    floor: l.floor,
    score: Number(r.score.final.toFixed(4)),
    reasons: r.explanations
      .map((e: any) => ({ concept: e.conceptLabel, points: e.reasons }))
      .filter((x: any) => x.points.length > 0),
    images: photoUrls(l),
  };
}

// 照片 URL：真实 Repliers → cdn.repliers.io 前缀；样例(无 images) → 稳定占位图。
export function photoUrls(l: Listing, count = 5): string[] {
  if (l.images && l.images.length) {
    return l.images.map((p: string) => (p.startsWith("http") ? p : `https://cdn.repliers.io/${p}`));
  }
  return Array.from({ length: count }, (_, i) => `https://picsum.photos/seed/${l.mlsNumber}-${i}/900/600`);
}
