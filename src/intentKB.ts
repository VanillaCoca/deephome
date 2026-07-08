// Deephome Intent Knowledge Base (意图知识库) —— 整个产品的核心资产。
//
// 为什么把它单独抽成一个「知识库」而不是让 LLM 每次自由发挥？
//   - 可审计：每一条「意图 → 属性」映射都写在这里，能被人检查、争论、纠正。
//   - 可改进：用户纠错（"我其实要景观不是采光"）可以沉淀成对某条映射的修正。
//   - 可解释：排序结果的「为什么」直接来自这里的 explain 函数，而非模型编造。
//   - 便宜且稳定：确定性执行，不为每次查询付 token，也不会漂移。
// LLM 负责它擅长的模糊活（把新说法映射到已知概念、消歧、否定、上下文），
// KB 负责必须正确的活（意图 → 加权属性计划）。这就是「知识库 grounding 的查询规划」。

import type { Listing, LiteralConstraints, PoiKind } from "./types";

export interface SoftSignalSpec {
  id: string;
  label: string;
  weight: number;
  score: (l: Listing) => number; // 0..1
  explain: (l: Listing) => string | null;
}

export interface PlacesSpec {
  kind: PoiKind;
  want: boolean;
  weight: number;
  radiusM: number;
}

export interface IntentConcept {
  id: string;
  labels: [string, string]; // [中文, English]
  gloss: string; // 这个概念背后的「真实目标」
  surfaceCues: string[]; // 命中短语：确定性匹配用，也作为 LLM 的候选词表(grounding)
  ambiguousCues?: string[]; // 「模糊入口」短语——命中时应触发澄清（如「大窗户」）
  clarify?: {
    question: string;
    options: { label: string; conceptId: string }[];
  };
  hard?: LiteralConstraints; // 仅当用户明确「必须」时才升级为硬过滤
  soft?: SoftSignalSpec[];
  text?: { term: string; weight: number }[];
  image?: { phrase: string; weight: number }[];
  places?: PlacesSpec[];
}

// ---------- 通用打分工具 ----------
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

function exposureScore(l: Listing, table: Partial<Record<string, number>>): number {
  const key = l.exposure ?? "null";
  return table[key] ?? table["null"] ?? 0.4;
}

// 楼层「高」的归一化：用楼栋总层数做分母，未知则给中性偏低分。
function floorHighScore(l: Listing): number {
  if (l.floor == null) return 0.3;
  const base = Math.max(l.storeys ?? 30, 8);
  return clamp01(l.floor / base);
}

// price / sqft 相对多伦多公寓的经验带（$/sqft）。越低越「划算」。
// 说明：这是离线替身。生产环境应改成「相对当前候选集或同小区中位数」的动态归一化。
function valueScore(l: Listing): number {
  if (!l.sqft || l.sqft <= 0) return 0.4;
  const ppsf = l.price / l.sqft;
  // 按交易类型分别归一化：买卖用 $/sqft，租赁用 月租$/sqft。避免把两者混在一个尺度里。
  if (l.type === "lease") return clamp01((6 - ppsf) / (6 - 3)); // 3(划算)..6(贵)
  return clamp01((1500 - ppsf) / (1500 - 900)); // 900(划算)..1500(贵)
}

const has = (l: Listing, ...needles: string[]) => {
  const hay = (l.remarks + " " + l.photoTags.join(" ")).toLowerCase();
  return needles.some((n) => hay.includes(n.toLowerCase()));
};

// =====================================================================
//  种子概念集（Toronto MVP）。刻意做「深」而非「全」：每条都有真实打分与解释。
// =====================================================================
export const CONCEPTS: IntentConcept[] = [
  // ---------- 采光好（旗舰例子）----------
  {
    id: "good_light",
    labels: ["采光好", "good natural light"],
    gloss:
      "用户要的是「明亮/阳光充足」的居住体验。真正决定它的是朝向、楼层、遮挡与开窗比例——而非字面的「大窗户」。",
    surfaceCues: [
      "采光", "阳光", "明亮", "通透", "晒得到太阳", "光线好",
      "natural light", "bright", "sunny", "sunlight", "sun-filled", "well lit",
    ],
    // 「大窗户」是模糊入口：可能想要采光，也可能想要景观或空间感。
    ambiguousCues: ["大窗户", "大窗", "落地窗", "big windows", "large windows", "floor-to-ceiling"],
    clarify: {
      question: "你说的「大窗户」，真正在意的是哪一个？",
      options: [
        { label: "采光 / 阳光充足", conceptId: "good_light" },
        { label: "景观 / 视野开阔", conceptId: "view" },
        { label: "空间感 / 通透宽敞", conceptId: "spacious" },
      ],
    },
    soft: [
      {
        id: "good_light/exposure",
        label: "朝向",
        weight: 1.0,
        score: (l) =>
          exposureScore(l, { S: 1, SE: 0.85, SW: 0.85, E: 0.55, W: 0.55, NE: 0.35, NW: 0.35, N: 0.1, null: 0.4 }),
        explain: (l) =>
          l.exposure ? `朝${zhExposure(l.exposure)}${["S", "SE", "SW"].includes(l.exposure) ? "（全天采光好）" : ""}` : null,
      },
      {
        id: "good_light/floor",
        label: "楼层",
        weight: 0.6,
        score: floorHighScore,
        explain: (l) => (l.floor != null && floorHighScore(l) > 0.5 ? `${l.floor}楼（高层，少遮挡）` : null),
      },
      {
        id: "good_light/window",
        label: "开窗比例",
        weight: 0.7,
        score: (l) => l.windowExposurePct ?? 0.4,
        explain: (l) =>
          l.windowExposurePct != null && l.windowExposurePct > 0.6
            ? `开窗比例约 ${Math.round(l.windowExposurePct * 100)}%` : null,
      },
      {
        id: "good_light/ceiling",
        label: "层高",
        weight: 0.25,
        score: (l) => (l.ceilingHeightFt ? clamp01((l.ceilingHeightFt - 8) / 4) : 0.4),
        explain: (l) => (l.ceilingHeightFt && l.ceilingHeightFt >= 9 ? `层高 ${l.ceilingHeightFt}ft` : null),
      },
    ],
    text: [
      { term: "south facing", weight: 1 },
      { term: "sun-filled", weight: 1 },
      { term: "bright", weight: 0.8 },
      { term: "unobstructed", weight: 0.7 },
      { term: "floor-to-ceiling windows", weight: 0.9 },
    ],
    image: [{ phrase: "bright sun-filled living room with large windows", weight: 1 }],
  },

  // ---------- 景观好 ----------
  {
    id: "view",
    labels: ["景观好", "great view"],
    gloss: "看出去的视野。楼层是主导因素，其次是朝向与遮挡。",
    surfaceCues: ["景观", "视野", "湖景", "看得远", "view", "skyline", "lake view", "cn tower"],
    soft: [
      { id: "view/floor", label: "楼层", weight: 1.0, score: floorHighScore,
        explain: (l) => (l.floor != null ? `${l.floor}楼${floorHighScore(l) > 0.6 ? "（高层视野开阔）" : ""}` : null) },
      { id: "view/window", label: "开窗比例", weight: 0.5, score: (l) => l.windowExposurePct ?? 0.4,
        explain: (l) => (l.windowExposurePct && l.windowExposurePct > 0.6 ? `大面积开窗` : null) },
      { id: "view/exposure", label: "朝向", weight: 0.4,
        score: (l) => exposureScore(l, { S: 0.8, W: 0.9, SW: 0.9, N: 0.5, null: 0.5 }),
        explain: (l) => (l.exposure && ["W", "SW", "S"].includes(l.exposure) ? `朝${zhExposure(l.exposure)}（易见日落/湖景）` : null) },
    ],
    text: [
      { term: "unobstructed view", weight: 1 },
      { term: "lake view", weight: 1 },
      { term: "skyline", weight: 0.9 },
    ],
    image: [{ phrase: "unobstructed city skyline or lake view from high floor", weight: 1 }],
  },

  // ---------- 安静 ----------
  {
    id: "quiet",
    labels: ["安静", "quiet"],
    gloss: "低噪音的居住环境。远离主干道/夜生活，楼层略高更好。",
    surfaceCues: ["安静", "清静", "不吵", "隔音", "quiet", "peaceful", "low noise", "tranquil"],
    soft: [
      { id: "quiet/floor", label: "楼层", weight: 0.4, score: floorHighScore,
        explain: (l) => (l.floor != null && floorHighScore(l) > 0.5 ? `${l.floor}楼（远离街面噪音）` : null) },
    ],
    text: [
      { term: "quiet street", weight: 1 },
      { term: "tree-lined", weight: 0.7 },
      { term: "cul-de-sac", weight: 0.8 },
      { term: "soundproof", weight: 0.6 },
    ],
    places: [
      { kind: "arterial", want: false, weight: 1.0, radiusM: 150 },
      { kind: "nightlife", want: false, weight: 0.7, radiusM: 200 },
    ],
  },

  // ---------- 通勤方便 ----------
  {
    id: "good_commute",
    labels: ["通勤方便", "good commute"],
    gloss: "上班/出行方便，主要靠近地铁/公交。",
    surfaceCues: ["通勤", "上班方便", "地铁", "交通方便", "近地铁", "subway", "ttc", "transit", "commute", "station"],
    soft: [],
    text: [
      { term: "steps to subway", weight: 1 },
      { term: "ttc", weight: 0.8 },
      { term: "transit", weight: 0.7 },
    ],
    places: [{ kind: "transit", want: true, weight: 1.0, radiusM: 600 }],
  },

  // ---------- 适合小孩 / 亲子 ----------
  {
    id: "family_friendly",
    labels: ["适合小孩", "family friendly"],
    gloss: "适合有小孩的家庭：好学区、近公园、房间数够。",
    surfaceCues: ["小孩", "孩子", "学区", "亲子", "家庭", "上学", "kids", "children", "school", "family"],
    soft: [
      { id: "family/beds", label: "房间数", weight: 0.5, score: (l) => clamp01((l.beds - 1) / 3),
        explain: (l) => (l.beds >= 3 ? `${l.beds}房（家庭够住）` : null) },
    ],
    text: [
      { term: "family-friendly", weight: 1 },
      { term: "school district", weight: 0.9 },
      { term: "playground", weight: 0.6 },
    ],
    places: [
      { kind: "school", want: true, weight: 1.0, radiusM: 800 },
      { kind: "park", want: true, weight: 0.6, radiusM: 700 },
    ],
  },

  // ---------- 宠物友好 / 养狗 ----------
  {
    id: "pet_friendly",
    labels: ["宠物友好", "pet friendly"],
    gloss: "能养宠物：允许养宠 + 附近有可遛狗的公园。",
    surfaceCues: ["养狗", "养猫", "宠物", "遛狗", "pet", "dog", "cat", "pets allowed"],
    soft: [
      { id: "pet/allowed", label: "允许养宠", weight: 1.0, score: (l) => (l.petsAllowed ? 1 : l.petsAllowed === false ? 0 : 0.4),
        explain: (l) => (l.petsAllowed ? "允许养宠物" : l.petsAllowed === false ? "⚠ 不允许宠物" : null) },
    ],
    text: [{ term: "pet friendly", weight: 1 }, { term: "pets allowed", weight: 1 }],
    places: [{ kind: "park", want: true, weight: 0.6, radiusM: 600 }],
  },

  // ---------- 性价比 ----------
  {
    id: "value_for_money",
    labels: ["性价比高", "good value"],
    gloss: "单位面积价格相对更划算。",
    surfaceCues: ["性价比", "便宜", "划算", "预算有限", "value", "affordable", "deal", "bang for buck"],
    soft: [
      { id: "value/ppsf", label: "单价", weight: 1.0, score: valueScore,
        explain: (l) => (l.sqft && valueScore(l) > 0.55 ? `约 $${Math.round(l.price / l.sqft)}/sqft（低于均价）` : null) },
    ],
    text: [{ term: "priced to sell", weight: 0.8 }, { term: "below market", weight: 0.9 }],
  },

  // ---------- 空间大 / 通透 ----------
  {
    id: "spacious",
    labels: ["空间大", "spacious"],
    gloss: "开阔、不局促：大面积 + 高层高 + open concept。",
    surfaceCues: ["宽敞", "开阔", "空间大", "不局促", "通透", "spacious", "open concept", "roomy"],
    soft: [
      { id: "spacious/sqft", label: "面积", weight: 1.0, score: (l) => (l.sqft ? clamp01((l.sqft - 450) / 900) : 0.4),
        explain: (l) => (l.sqft && l.sqft >= 800 ? `${l.sqft} sqft（宽敞）` : null) },
      { id: "spacious/ceiling", label: "层高", weight: 0.4, score: (l) => (l.ceilingHeightFt ? clamp01((l.ceilingHeightFt - 8) / 4) : 0.4),
        explain: (l) => (l.ceilingHeightFt && l.ceilingHeightFt >= 9 ? `层高 ${l.ceilingHeightFt}ft` : null) },
    ],
    text: [{ term: "open concept", weight: 1 }, { term: "spacious", weight: 0.8 }],
  },

  // ---------- 储物多 ----------
  {
    id: "storage",
    labels: ["储物多", "lots of storage"],
    gloss: "收纳空间充足：面积 + locker/步入式衣柜等。",
    surfaceCues: ["储物", "收纳", "衣柜", "杂物", "locker", "storage", "closet"],
    soft: [
      { id: "storage/sqft", label: "面积", weight: 0.5, score: (l) => (l.sqft ? clamp01((l.sqft - 450) / 900) : 0.4),
        explain: (l) => (l.sqft && l.sqft >= 800 ? `${l.sqft} sqft` : null) },
      { id: "storage/locker", label: "储物间", weight: 0.8, score: (l) => (has(l, "locker", "walk-in", "walk in closet", "储物", "ample storage") ? 1 : 0.3),
        explain: (l) => (has(l, "locker", "walk-in", "ample storage") ? "含 locker / 步入式衣柜" : null) },
    ],
    text: [{ term: "ample storage", weight: 1 }, { term: "walk-in closet", weight: 0.9 }, { term: "locker", weight: 0.8 }],
  },

  // ---------- 装修好 / 拎包入住 ----------
  {
    id: "move_in_ready",
    labels: ["装修好", "renovated / move-in ready"],
    gloss: "已翻新、可直接入住。",
    surfaceCues: ["装修好", "精装", "翻新", "拎包入住", "renovated", "updated", "move-in ready", "turnkey"],
    soft: [
      { id: "reno/tag", label: "翻新", weight: 1.0, score: (l) => (has(l, "renovated", "updated", "modern", "turnkey", "精装", "翻新") ? 1 : 0.35),
        explain: (l) => (has(l, "renovated", "updated", "modern", "turnkey") ? "已翻新/现代化" : null) },
    ],
    text: [{ term: "renovated", weight: 1 }, { term: "updated kitchen", weight: 0.8 }, { term: "modern", weight: 0.6 }],
    image: [{ phrase: "renovated modern kitchen", weight: 0.8 }],
  },
];

export const CONCEPT_BY_ID: Record<string, IntentConcept> = Object.fromEntries(
  CONCEPTS.map((c) => [c.id, c]),
);

export function zhExposure(e: NonNullable<Listing["exposure"]>): string {
  return { N: "北", S: "南", E: "东", W: "西", NE: "东北", NW: "西北", SE: "东南", SW: "西南" }[e];
}
