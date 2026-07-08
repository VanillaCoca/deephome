// 数据源抽象。意图引擎/规划/排序全部与「数据从哪来」解耦。
//   - LocalSampleSource：离线样例数据，零依赖跑通全流程（demo 用）。
//   - RepliersSource：真实 Repliers API 适配器（需 API key）。
// 实测：免费 Preview/trial 档能跑结构化过滤，但文本字段被打乱、朝向/楼层常缺失，
// 且 AI 图搜 / Places 需付费升级（会 403）。因此图搜默认关闭，见 useImageSearch。

import type { Listing, LiteralConstraints, QueryPlan } from "./types";
import { SAMPLE_LISTINGS } from "./sampleData";

export interface ListingSource {
  // 用硬过滤生成候选集。软信号/文本/图搜在排序层处理。
  search(hard: LiteralConstraints, plan?: QueryPlan): Promise<Listing[]>;
}

function passesHard(l: Listing, h: LiteralConstraints): boolean {
  if (h.city && l.city.toLowerCase() !== h.city.toLowerCase()) return false;
  if (h.neighborhood && l.neighborhood.toLowerCase() !== h.neighborhood.toLowerCase()) return false;
  if (h.propertyType && l.propertyType !== h.propertyType) return false;
  if (h.type && l.type !== h.type) return false;
  if (h.minBeds && l.beds < h.minBeds) return false;
  if (h.maxPrice && l.price > h.maxPrice) return false;
  if (h.minPrice && l.price < h.minPrice) return false;
  if (h.minParking && l.parking < h.minParking) return false;
  if (h.petsAllowed && l.petsAllowed === false) return false;
  return true;
}

export class LocalSampleSource implements ListingSource {
  constructor(private data: Listing[] = SAMPLE_LISTINGS) {}
  async search(hard: LiteralConstraints): Promise<Listing[]> {
    return this.data.filter((l) => passesHard(l, hard));
  }
}

export interface RepliersOptions {
  base?: string;
  // AI 图搜是付费功能：默认关闭，避免未授权账号一碰含图搜概念的意图就整个 403。
  useImageSearch?: boolean;
}

// 真实 Repliers 适配器。把 QueryPlan 的硬过滤映射成 /listings 查询参数；
// 文本词走 keyword 搜索；图搜概念（若已授权）走 imageSearchItems。
export class RepliersSource implements ListingSource {
  private base: string;
  private useImageSearch: boolean;
  constructor(private apiKey: string, opts: RepliersOptions = {}) {
    this.base = opts.base ?? "https://api.repliers.io";
    this.useImageSearch = opts.useImageSearch ?? false;
  }

  async search(hard: LiteralConstraints, plan?: QueryPlan): Promise<Listing[]> {
    const params = new URLSearchParams();
    if (hard.city) params.set("city", hard.city);
    if (hard.neighborhood) params.set("neighborhood", hard.neighborhood);
    if (hard.propertyType) params.set("propertyType", hard.propertyType);
    if (hard.type) params.set("type", hard.type);
    if (hard.minBeds) params.set("minBeds", String(hard.minBeds));
    if (hard.maxPrice) params.set("maxPrice", String(hard.maxPrice));
    if (hard.minParking) params.set("minParkingSpaces", String(hard.minParking));
    // 关键词分支：把高权重文本词并进 search（Repliers keyword search）
    const kw = (plan?.textTerms ?? []).sort((a, b) => b.weight - a.weight).slice(0, 5).map((t) => t.term);
    if (kw.length) params.set("search", kw.join(" "));
    params.set("status", "A"); // active
    params.set("resultsPerPage", "100");

    const body =
      this.useImageSearch && plan?.imageConcepts.length
        ? { imageSearchItems: plan.imageConcepts.map((i) => ({ type: "text", value: i.phrase, boost: i.weight })) }
        : undefined;

    const res = await fetch(`${this.base}/listings?${params.toString()}`, {
      method: body ? "POST" : "GET",
      headers: { "REPLIERS-API-KEY": this.apiKey, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Repliers ${res.status}: ${await res.text()}`);
    const json: any = await res.json();
    return (json.listings ?? []).map(mapRepliersListing);
  }
}

// Repliers 原始 listing → 规范化 Listing（字段名按实测校准）。
function parseSqft(s: any): number | null {
  if (s == null) return null;
  const m = String(s).match(/\d{3,}/);
  return m ? Number(m[0]) : null;
}

function mapRepliersListing(r: any): Listing {
  const d = r.details ?? {};
  return {
    mlsNumber: r.mlsNumber,
    type: String(r.type).toLowerCase() === "lease" ? "lease" : "sale",
    propertyType: d.propertyType ?? "",
    city: r.address?.city ?? "",
    neighborhood: r.address?.neighborhood ?? "",
    lat: Number(r.map?.latitude ?? 0),
    lng: Number(r.map?.longitude ?? 0),
    price: Number(r.listPrice ?? 0),
    beds: Number(d.numBedrooms ?? 0) + Number(d.numBedroomsPlus ?? 0),
    baths: Number(d.numBathrooms ?? 0),
    sqft: parseSqft(d.sqft ?? d.sqftRange),
    exposure: (d.exposure ?? null) as Listing["exposure"],
    floor: d.floorNum ? Number(d.floorNum) : null,
    storeys: d.numStoreys ? Number(d.numStoreys) : null,
    ceilingHeightFt: null, // MLS 通常无——需从 remarks/照片 富化
    windowExposurePct: null, // 需从图片洞察富化
    balcony: d.balcony ?? null,
    parking: Number(d.numParkingSpaces ?? d.numGarageSpaces ?? 0),
    petsAllowed: null,
    remarks: d.description ?? "",
    photoTags: [],
    nearby: [], // 由 /places 端点富化（付费）
  };
}
