// 离线样例房源（多伦多）。字段结构对齐 Repliers /listings 规范化后的形状。
// 刻意设计成：某些房源「字面上写着 big windows」但朝北/低层，用来演示
// 「字面关键词 ≠ 最优匹配」——这正是 Deephome 意图引擎要证明的核心论点。

import type { Listing } from "./types";

export const SAMPLE_LISTINGS: Listing[] = [
  {
    mlsNumber: "C001", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Liberty Village",
    lat: 43.638, lng: -79.419, price: 720000, beds: 2, baths: 2, sqft: 780,
    exposure: "S", floor: 28, storeys: 32, ceilingHeightFt: 9, windowExposurePct: 0.85, balcony: "open", parking: 1, petsAllowed: true,
    remarks: "Bright south-facing corner unit, floor-to-ceiling windows, unobstructed sun all day. Renovated modern kitchen.",
    photoTags: ["bright living room", "large windows", "modern kitchen", "city view"],
    nearby: [{ kind: "transit", name: "Exhibition GO", lat: 43.6366, lng: -79.4185 }, { kind: "park", name: "Liberty Park", lat: 43.6375, lng: -79.42 }],
  },
  {
    mlsNumber: "C002", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Liberty Village",
    lat: 43.6372, lng: -79.4205, price: 690000, beds: 2, baths: 2, sqft: 760,
    exposure: "N", floor: 3, storeys: 32, ceilingHeightFt: 8, windowExposurePct: 0.45, balcony: "open", parking: 1, petsAllowed: true,
    // 陷阱房：字面写着 big windows，但朝北 + 3 楼 → 采光其实一般。
    remarks: "Spacious unit with big windows and open concept living. Steps to shops.",
    photoTags: ["big windows", "open concept", "bedroom"],
    nearby: [{ kind: "arterial", name: "King St W", lat: 43.6376, lng: -79.4207 }, { kind: "nightlife", name: "Bar strip", lat: 43.6378, lng: -79.421 }],
  },
  {
    mlsNumber: "C003", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Yorkville",
    lat: 43.671, lng: -79.389, price: 1180000, beds: 2, baths: 2, sqft: 900,
    exposure: "SW", floor: 21, storeys: 40, ceilingHeightFt: 10, windowExposurePct: 0.8, balcony: "open", parking: 1, petsAllowed: true,
    remarks: "Sun-filled SW exposure, unobstructed skyline view, 10ft ceilings, high-end finishes.",
    photoTags: ["skyline view", "large windows", "bright", "renovated"],
    nearby: [{ kind: "transit", name: "Bay Station", lat: 43.6705, lng: -79.3895 }, { kind: "school", name: "Jesse Ketchum PS", lat: 43.6725, lng: -79.3905 }],
  },
  {
    mlsNumber: "C004", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "The Annex",
    lat: 43.667, lng: -79.407, price: 640000, beds: 1, baths: 1, sqft: 560,
    exposure: "E", floor: 12, storeys: 18, ceilingHeightFt: 9, windowExposurePct: 0.6, balcony: "encl", parking: 0, petsAllowed: true,
    remarks: "Quiet tree-lined street, morning sun, updated kitchen, locker included.",
    photoTags: ["updated kitchen", "bedroom", "locker"],
    nearby: [{ kind: "transit", name: "Spadina Station", lat: 43.6672, lng: -79.4045 }, { kind: "park", name: "Sibelius Park", lat: 43.669, lng: -79.408 }],
  },
  {
    mlsNumber: "C005", type: "sale", propertyType: "Detached", city: "Toronto", neighborhood: "Leslieville",
    lat: 43.663, lng: -79.335, price: 1450000, beds: 4, baths: 3, sqft: 2100,
    exposure: "S", floor: null, storeys: 2, ceilingHeightFt: 9, windowExposurePct: 0.7, balcony: null, parking: 2, petsAllowed: true,
    remarks: "Renovated family home on a quiet cul-de-sac, south-facing backyard, steps to great schools and parks.",
    photoTags: ["backyard", "renovated", "family room"],
    nearby: [{ kind: "school", name: "Morse St PS", lat: 43.6625, lng: -79.336 }, { kind: "park", name: "Greenwood Park", lat: 43.664, lng: -79.331 }],
  },
  {
    mlsNumber: "C006", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "King West",
    lat: 43.6435, lng: -79.401, price: 599000, beds: 1, baths: 1, sqft: 520,
    exposure: "SE", floor: 16, storeys: 25, ceilingHeightFt: 9, windowExposurePct: 0.72, balcony: "open", parking: 0, petsAllowed: true,
    remarks: "Bright SE unit, priced to sell, below market, steps to subway and transit.",
    photoTags: ["bright", "balcony", "large windows"],
    nearby: [{ kind: "transit", name: "St Andrew Station", lat: 43.6475, lng: -79.3845 }, { kind: "nightlife", name: "Club district", lat: 43.6438, lng: -79.4 }],
  },
  {
    mlsNumber: "C007", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Midtown",
    lat: 43.704, lng: -79.398, price: 820000, beds: 2, baths: 2, sqft: 840,
    exposure: "W", floor: 30, storeys: 34, ceilingHeightFt: 9, windowExposurePct: 0.78, balcony: "open", parking: 1, petsAllowed: false,
    remarks: "High floor west view, sunset exposure, ample storage and walk-in closet. No pets.",
    photoTags: ["view", "walk-in closet", "large windows"],
    nearby: [{ kind: "transit", name: "Eglinton Station", lat: 43.7055, lng: -79.398 }, { kind: "school", name: "North Toronto CI", lat: 43.706, lng: -79.4 }],
  },
  {
    mlsNumber: "C008", type: "sale", propertyType: "Townhouse", city: "Toronto", neighborhood: "The Beaches",
    lat: 43.671, lng: -79.298, price: 980000, beds: 3, baths: 2, sqft: 1500,
    exposure: "S", floor: null, storeys: 3, ceilingHeightFt: 9, windowExposurePct: 0.68, balcony: null, parking: 1, petsAllowed: true,
    remarks: "Family townhome near the lake, quiet street, close to schools and boardwalk, bright open concept main floor.",
    photoTags: ["open concept", "backyard", "bright"],
    nearby: [{ kind: "school", name: "Balmy Beach PS", lat: 43.6705, lng: -79.297 }, { kind: "park", name: "Kew Gardens", lat: 43.6685, lng: -79.297 }],
  },
  {
    mlsNumber: "C009", type: "lease", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Distillery",
    lat: 43.65, lng: -79.359, price: 2900, beds: 1, baths: 1, sqft: 600,
    exposure: "N", floor: 8, storeys: 20, ceilingHeightFt: 9, windowExposurePct: 0.5, balcony: "encl", parking: 0, petsAllowed: true,
    remarks: "Cozy 1-bed for lease, enclosed balcony, pet friendly building, near transit.",
    photoTags: ["bedroom", "balcony"],
    nearby: [{ kind: "transit", name: "King streetcar", lat: 43.6505, lng: -79.36 }, { kind: "park", name: "Distillery green", lat: 43.6505, lng: -79.3585 }],
  },
  {
    mlsNumber: "C010", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Liberty Village",
    lat: 43.6382, lng: -79.4195, price: 760000, beds: 2, baths: 2, sqft: 810,
    exposure: "SW", floor: 24, storeys: 30, ceilingHeightFt: 9, windowExposurePct: 0.82, balcony: "open", parking: 1, petsAllowed: true,
    remarks: "Sun-drenched southwest corner, unobstructed, floor-to-ceiling windows, spacious open concept, ample storage.",
    photoTags: ["large windows", "bright", "spacious", "locker"],
    nearby: [{ kind: "transit", name: "Exhibition GO", lat: 43.6366, lng: -79.4185 }, { kind: "park", name: "Liberty Park", lat: 43.6375, lng: -79.42 }],
  },
  {
    mlsNumber: "C011", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "North York",
    lat: 43.767, lng: -79.412, price: 560000, beds: 1, baths: 1, sqft: 540,
    exposure: "S", floor: 6, storeys: 22, ceilingHeightFt: 8, windowExposurePct: 0.62, balcony: "open", parking: 1, petsAllowed: true,
    remarks: "Affordable south-facing unit, good value below market, close to subway station.",
    photoTags: ["bright", "bedroom"],
    nearby: [{ kind: "transit", name: "North York Centre", lat: 43.768, lng: -79.4125 }],
  },
  {
    mlsNumber: "C012", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Yorkville",
    lat: 43.6705, lng: -79.3925, price: 1350000, beds: 2, baths: 2, sqft: 950,
    exposure: "N", floor: 33, storeys: 45, ceilingHeightFt: 10, windowExposurePct: 0.8, balcony: "open", parking: 1, petsAllowed: true,
    // 高层但朝北：景观强(高层)、采光弱(北)——用于区分 view vs good_light。
    remarks: "Very high floor with dramatic unobstructed north skyline view, large windows, luxury finishes.",
    photoTags: ["skyline view", "large windows", "high floor"],
    nearby: [{ kind: "transit", name: "Bay Station", lat: 43.6705, lng: -79.3895 }],
  },
  {
    mlsNumber: "C013", type: "lease", propertyType: "Condo Apt", city: "Toronto", neighborhood: "King West",
    lat: 43.6442, lng: -79.4025, price: 2600, beds: 1, baths: 1, sqft: 500,
    exposure: "S", floor: 19, storeys: 26, ceilingHeightFt: 9, windowExposurePct: 0.74, balcony: "open", parking: 0, petsAllowed: false,
    remarks: "Bright south unit for lease, high floor, steps to TTC and subway, quiet interior facing.",
    photoTags: ["bright", "large windows"],
    nearby: [{ kind: "transit", name: "St Andrew Station", lat: 43.6475, lng: -79.3845 }],
  },
  {
    mlsNumber: "C014", type: "sale", propertyType: "Detached", city: "Toronto", neighborhood: "Leslieville",
    lat: 43.662, lng: -79.338, price: 1250000, beds: 3, baths: 2, sqft: 1650,
    exposure: "W", floor: null, storeys: 2, ceilingHeightFt: 9, windowExposurePct: 0.6, balcony: null, parking: 1, petsAllowed: true,
    remarks: "Charming home near a busy main road, updated interior, close to shops and transit.",
    photoTags: ["renovated", "kitchen"],
    nearby: [{ kind: "arterial", name: "Queen St E", lat: 43.6622, lng: -79.3382 }, { kind: "transit", name: "Queen streetcar", lat: 43.6623, lng: -79.338 }],
  },
];
