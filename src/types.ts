// Deephome Intent Engine — core types
// 核心数据模型。所有模块共享这里的类型。
// 设计原则：把「用户说的话(surface)」、「真实意图(intent)」、「可查询属性(attribute)」三者显式分离。

// ---------- 房源规范化模型（对齐 Repliers /listings 字段 + 富化字段）----------

export type Exposure = "N" | "S" | "E" | "W" | "NE" | "NW" | "SE" | "SW" | null;

export type PoiKind =
  | "transit"
  | "school"
  | "park"
  | "grocery"
  | "nightlife"
  | "arterial"; // arterial = 主干道/噪音源

export interface Poi {
  kind: PoiKind;
  name: string;
  lat: number;
  lng: number;
  rating?: number; // 0..5，可选
}

export interface Listing {
  mlsNumber: string;
  type: "sale" | "lease";
  propertyType: string; // 'Condo Apt' | 'Detached' | 'Townhouse' ...
  city: string;
  neighborhood: string;
  lat: number;
  lng: number;
  price: number;
  beds: number;
  baths: number;
  sqft: number | null;

  // —— 与「潜在意图」直接相关的富化字段 ——
  // 这些字段大多不是用户会直接搜的，但却是意图的真正决定因素。
  exposure: Exposure; // 朝向
  floor: number | null; // 单元所在楼层
  storeys: number | null; // 楼栋总层数（用于把「楼层高」归一化）
  ceilingHeightFt: number | null; // 层高（英尺）
  windowExposurePct: number | null; // 0..1，开窗/玻璃占比（富化估计，采光代理指标）
  balcony: string | null; // 'open' | 'encl' | null
  parking: number;
  petsAllowed: boolean | null;

  remarks: string; // 房源自由文本（BM25 / 语义分支使用）
  photoTags: string[]; // 图片洞察标签（作为 Repliers AI 图搜的离线替身）
  nearby: Poi[]; // 来自 Places 端点的富化数据
  images?: string[]; // 照片路径（Repliers 为相对路径，前缀 https://cdn.repliers.io/）
}

// ---------- 意图帧（Intent Frame）：意图理解层的输出 ----------

export type Hardness = "hard" | "soft"; // 「必须」 vs 「偏好」
export type Polarity = 1 | -1; // 想要 vs 想避免

// 直通式硬约束——和 Repliers NLP 做的一样的「字面参数」。
export interface LiteralConstraints {
  city?: string;
  neighborhood?: string;
  propertyType?: string;
  type?: "sale" | "lease";
  minBeds?: number;
  minBaths?: number;
  maxPrice?: number;
  minPrice?: number;
  minParking?: number;
  petsAllowed?: boolean;
}

export interface IntentItem {
  surface: string; // 用户字面说的
  kind: "literal" | "intent" | "novel";
  conceptId?: string; // kind==='intent' 时，命中的 KB 概念
  literal?: LiteralConstraints; // kind==='literal' 时
  polarity: Polarity;
  hardness: Hardness;
  weight: number; // 用户强调程度 0..1
  confidence: number; // 引擎置信度 0..1
  note?: string;
}

export interface Clarification {
  itemSurface: string;
  question: string;
  options: { label: string; conceptId: string }[];
}

export interface IntentFrame {
  rawQuery: string;
  items: IntentItem[];
  clarifications: Clarification[];
}

// ---------- 查询计划（Query Plan）：意图→属性映射层的输出 ----------

// 软信号：一个可打分的属性偏好。score 返回 0..1，表示该房源满足此偏好的程度。
export interface SoftSignal {
  id: string; // e.g. 'good_light/exposure'
  conceptId: string; // 服务于哪个意图（用于解释）
  label: string; // 人类可读，如「朝向」
  weight: number; // 对最终分的贡献
  polarity: Polarity;
  score: (l: Listing) => number; // 0..1
  explain: (l: Listing) => string | null; // 命中时的解释文本
}

export interface TextTerm {
  term: string;
  weight: number;
  conceptId: string;
}

export interface ImageConcept {
  phrase: string;
  weight: number;
  conceptId: string;
}

export interface PlacesSignal {
  conceptId: string;
  kind: PoiKind;
  want: boolean; // true=希望靠近；false=希望远离（如主干道）
  weight: number;
  radiusM: number;
}

// 邻近锚点：用户显式选中的一个地点（大学 / 公司 / 地标），排序时「越近越高」。
// 与 placesSignals 不同——那是「附近有没有某类 POI」，这是「离我指定的这个点多近」。
export interface AnchorSignal {
  lat: number;
  lng: number;
  label: string; // 展示用，如「多伦多大学」
  weight: number; // 融合时的分支权重（用户显式选点，给较强的权重）
  halfDistM: number; // 距此距离时约得 0.5 分（距离衰减尺度）
}

export interface QueryPlan {
  hardFilters: LiteralConstraints;
  softSignals: SoftSignal[];
  textTerms: TextTerm[];
  imageConcepts: ImageConcept[];
  placesSignals: PlacesSignal[];
  anchor?: AnchorSignal; // 可选：仅当用户选了「离 X 近」时存在
  intentSummary: string; // 「我把你的X理解为想要Y，正在按 a/b/c 排序」
}

// ---------- 排序输出 ----------

export interface ScoreBreakdown {
  structured: number;
  text: number;
  image: number;
  places: number;
  anchor?: number; // 邻近锚点分支（仅当有锚点时）
  final: number;
}

export interface Explanation {
  conceptId: string;
  conceptLabel: string;
  reasons: string[]; // 命中的属性解释
}

export interface ScoredListing {
  listing: Listing;
  score: ScoreBreakdown;
  explanations: Explanation[];
}
