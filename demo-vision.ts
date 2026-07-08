// 视觉抽取 demo：证明「开窗比例」应当来自【照片】，而非措辞。
// 关键看点：当文案与照片【不一致】时，视觉信号以更高置信度覆盖措辞猜测（可上可下）。
// 用法： npx tsx demo-vision.ts   （离线，用 MockVisionAdapter 模拟照片视觉）

import { enrich } from "./src/enrich";
import type { RawListing } from "./src/enrich";
import { MockVisionAdapter } from "./src/vision";

// 三套房：文案对窗户的说法各不相同。
const RAWS: RawListing[] = [
  {
    mlsNumber: "V001", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "CityPlace",
    lat: 43.64, lng: -79.39, price: 700000, beds: 2, baths: 2, sqft: 760, rawExposure: "West", rawFloor: 10, rawStoreys: 30,
    remarks: "Spacious unit with big windows and open concept living. Steps to transit.", // 文案吹「big windows」
    photoTags: ["open concept"],
  },
  {
    mlsNumber: "V002", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "Leslieville",
    lat: 43.66, lng: -79.34, price: 680000, beds: 1, baths: 1, sqft: 600, rawExposure: "South", rawFloor: 15, rawStoreys: 25,
    remarks: "Updated kitchen, quiet street, move-in ready.", // 文案【只字未提】窗户
    photoTags: ["updated kitchen"],
  },
  {
    mlsNumber: "V003", type: "sale", propertyType: "Condo Apt", city: "Toronto", neighborhood: "King West",
    lat: 43.644, lng: -79.40, price: 820000, beds: 2, baths: 2, sqft: 840, rawExposure: "South", rawFloor: 22, rawStoreys: 30,
    remarks: "Bright unit with floor-to-ceiling windows and unobstructed views.", // 文案说落地窗
    photoTags: ["large windows"],
  },
];

// 模拟「照片实际长什么样」——视觉模型看照片给出的窗户显著度分数。
// 故意与文案制造分歧：V001 文案吹大窗但照片其实一般；V002 文案没提但照片是落地窗。
const PHOTO_VISION: Record<string, number> = {
  V001: 0.40, // 照片显示：其实是普通窗
  V002: 0.90, // 照片显示：整面落地窗（文案漏了）
  V003: 0.85, // 照片证实：确有落地窗
};

const arrow = (a: number | null, b: number | null) => {
  if (a == null || b == null) return "";
  if (b > a + 0.03) return `↑ 上修 (照片比文案更亮)`;
  if (b < a - 0.03) return `↓ 下修 (照片没文案吹的那么亮)`;
  return `≈ 一致 (照片印证文案)`;
};

async function main() {
  const vision = new MockVisionAdapter(PHOTO_VISION);
  console.log("#".repeat(84));
  console.log("# 开窗比例：措辞猜测  →  照片派生（VisionAdapter 覆盖）");
  console.log("#".repeat(84));
  for (const raw of RAWS) {
    const wording = await enrich(raw); // 无 vision：仅靠 remarks 措辞
    const withPhoto = await enrich(raw, { vision }); // 有 vision：照片派生
    const a = wording.report.windowExposurePct;
    const b = withPhoto.report.windowExposurePct;
    console.log(`\n[${raw.mlsNumber}] ${raw.neighborhood}  «${raw.remarks}»`);
    console.log(`   措辞猜测 : ${fmt(a)}`);
    console.log(`   照片派生 : ${fmt(b)}   ${arrow(a.value as number, b.value as number)}`);
  }
  console.log("\n结论：");
  console.log("  · V001 文案吹「big windows」→措辞猜 0.70，但照片显示普通窗 →下修到 0.40（防文案注水）");
  console.log("  · V002 文案没提窗户 →措辞只能给默认 0.45，但照片是落地窗 →上修到 0.90（补文案遗漏）");
  console.log("  · V003 文案说落地窗，照片印证 →维持 0.85");
  console.log("\n真实接入：把 MockVisionAdapter 换成 RepliersVisionAdapter({ apiKey })，");
  console.log("  分数来自 Repliers AI Image Search 对真实照片的打分（免费 Preview 档即可，仅限 sample data）。");
}

function fmt(t: { value: unknown; source: string; confidence: number; note?: string }) {
  const v = t.value === null ? "—" : String(t.value);
  return `${v}\t(${t.source} 置信${t.confidence.toFixed(2)}${t.note ? " · " + t.note : ""})`;
}

main().catch((e) => { console.error(e); process.exit(1); });
