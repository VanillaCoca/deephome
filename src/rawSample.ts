// 原始 MLS 形状的样例（只有 remarks + 基础字段 + 可选图片标签）。
// 关键：这里【没有】exposure/windowExposurePct/ceilingHeightFt/petsAllowed 这些富化字段——
// 它们要由 enrich.ts 从 rawExposure/rawFloor + remarks + photoTags 派生出来。
// 用来证明：意图排序所依赖的属性，可以从真实 MLS 会给的东西里造出来。

import type { RawListing } from "./enrich";

export const RAW_LISTINGS: RawListing[] = [
  {
    mlsNumber: "R001", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Liberty Village",
    lat: 43.638, lng: -79.419, price: 720000, beds: 2, baths: 2, sqft: 780,
    parking: 1, rawExposure: "South", rawFloor: 28, rawStoreys: 32,
    remarks: "Bright south-facing corner unit with floor-to-ceiling windows and 10ft ceilings. Pet friendly building. Renovated kitchen.",
    photoTags: ["large windows", "bright living room", "modern kitchen"],
    nearby: [{ kind: "transit", name: "Exhibition GO", lat: 43.6366, lng: -79.4185 }],
  },
  {
    mlsNumber: "R002", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Liberty Village",
    lat: 43.6372, lng: -79.4205, price: 690000, beds: 2, baths: 2, sqft: 760,
    parking: 1, rawExposure: "North", rawFloor: 3, rawStoreys: 32,
    // 陷阱房：文本写着 big windows，但 MLS 明确朝北 + 3 楼。富化后采光分应该低。
    remarks: "Spacious unit with big windows and open concept living. Steps to shops and restaurants.",
    photoTags: ["big windows", "open concept"],
    nearby: [{ kind: "arterial", name: "King St W", lat: 43.6376, lng: -79.4207 }],
  },
  {
    mlsNumber: "R003", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Yorkville",
    lat: 43.671, lng: -79.389, price: 1180000, beds: 2, baths: 2, sqft: 900,
    parking: 1, rawExposure: "Sw", rawFloor: 21, rawStoreys: 40,
    remarks: "Sun-filled southwest exposure with 10 foot ceilings and unobstructed views. High-end finishes.",
    photoTags: ["skyline view", "large windows"],
    nearby: [{ kind: "transit", name: "Bay Station", lat: 43.6705, lng: -79.3895 }],
  },
  {
    mlsNumber: "R004", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "The Annex",
    lat: 43.667, lng: -79.407, price: 640000, beds: 1, baths: 1, sqft: 560,
    parking: 0, rawExposure: "East", rawFloor: 12, rawStoreys: 18,
    remarks: "Quiet tree-lined street, morning sun, updated kitchen, locker included. No pets permitted.",
    photoTags: ["updated kitchen"],
    nearby: [{ kind: "transit", name: "Spadina Station", lat: 43.6672, lng: -79.4045 }, { kind: "park", name: "Sibelius Park", lat: 43.669, lng: -79.408 }],
  },
  {
    mlsNumber: "R005", type: "sale", propertyType: "Detached", city: "Toronto", neighborhood: "Leslieville",
    lat: 43.663, lng: -79.335, price: 1450000, beds: 4, baths: 3, sqft: 2100,
    parking: 2, rawExposure: null, rawFloor: null, rawStoreys: 2,
    // 无 MLS 朝向：从文本 "south-facing backyard" 推断；pets welcome。
    remarks: "Renovated family home on a quiet cul-de-sac with a south-facing backyard. Steps to great schools. Pets welcome.",
    photoTags: ["backyard", "renovated"],
    nearby: [{ kind: "school", name: "Morse St PS", lat: 43.6625, lng: -79.336 }, { kind: "park", name: "Greenwood Park", lat: 43.664, lng: -79.331 }],
  },
  {
    mlsNumber: "R006", type: "lease", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Distillery",
    lat: 43.65, lng: -79.359, price: 2900, beds: 1, baths: 1, sqft: 600,
    parking: 0, rawExposure: "North", rawFloor: 8, rawStoreys: 20,
    remarks: "Cozy 1-bed with an enclosed balcony. Pet friendly building, steps to transit.",
    photoTags: ["bedroom"],
    nearby: [{ kind: "transit", name: "King streetcar", lat: 43.6505, lng: -79.36 }, { kind: "park", name: "Distillery green", lat: 43.6505, lng: -79.3585 }],
  },
];
