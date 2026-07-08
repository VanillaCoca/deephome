// 数据源抽象。意图引擎/规划/排序全部与「数据从哪来」解耦。
//   - LocalSampleSource：离线样例数据，零依赖跑通全流程（demo 用）。
//   - RepliersSource：真实 Repliers API 适配器（需 API key + MLS 授权）。
// 免费 Preview 档能跑 RepliersSource 的结构过滤/关键词/图搜——但只针对 sample data；
// 真实在售房源需 Standard 档 + 牌照。因此 demo 默认走 LocalSampleSource。

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

// ---- 真实 Repliers 适配器（示意实现，未在 demo 中执行）----
// 把 QueryPlan 的硬过滤映射成 /listings 查询参数；文本词走 keyword 搜索；
// 图搜概念走 imageSearchItems。生产中在此 map 响应 → 规范化 Listing。
export class RepliersSource implements ListingSource {
  constructor(private apiKey: string, private base = "https://api.repliers.io") {}

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
      plan?.imageConcepts.length
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

// Repliers 原始 listing → 规范化 Listing。字段名以官方为准，这里给出常见映射示意。
function mapRepliersListing(r: any): Listing {
  return {
    mlsNumber: r.mlsNumber,
    type: r.type === "Lease" || r.type === "lease" ? "lease" : "sale",
    propertyType: r.details?.propertyType ?? r.propertyType ?? "Condo Apt",
    city: r.address?.city ?? "",
    neighborhood: r.address?.neighborhood ?? "",
    lat: Number(r.map?.latitude ?? r.latitude ?? 0),
    lng: Number(r.map?.longitude ?? r.longitude ?? 0),
    price: Number(r.listPrice ?? r.price ?? 0),
    beds: Number(r.details?.numBedrooms ?? r.beds ?? 0),
    baths: Number(r.details?.numBathrooms ?? r.baths ?? 0),
    sqft: r.details?.sqft ? Number(String(r.details.sqft).split("-")[0]) : null,
    exposure: (r.details?.exposure ?? null) as Listing["exposure"],
    floor: r.details?.floorNum ? Number(r.details.floorNum) : null,
    storeys: r.details?.numStoreys ? Number(r.details.numStoreys) : null,
    ceilingHeightFt: null, // MLS 通常无——需从 remarks 富化
    windowExposurePct: null, // 需从图片洞察富化
    balcony: r.details?.balcony ?? null,
    parking: Number(r.details?.numParkingSpaces ?? 0),
    petsAllowed: null,
    remarks: r.details?.description ?? r.remarks ?? "",
    photoTags: r.imageInsights?.tags ?? [],
    nearby: [], // 由 /places 端点富化
  };
}
