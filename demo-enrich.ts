// 富化管线演示： 原始 MLS  →  富化(带来源/置信度)  →  意图排序仍然成立。
// 用法： npx tsx demo-enrich.ts   或   npm run build 后 node dist/demo-enrich.js

import { enrich, enrichAll } from "./src/enrich";
import { RAW_LISTINGS } from "./src/rawSample";
import { search } from "./src/pipeline";
import { LocalSampleSource } from "./src/sources";
import type { FieldTrace } from "./src/enrich";

const cell = (t: FieldTrace) => {
  const v = t.value === null ? "—" : String(t.value);
  return `${v} (${t.source} ${t.confidence.toFixed(2)})`;
};

async function main() {
  console.log("#".repeat(80));
  console.log("# ① 富化：从原始 MLS(remarks + 基础字段) 派生意图所需属性，并记录来源/置信度");
  console.log("#".repeat(80));
  for (const raw of RAW_LISTINGS) {
    const { report } = await enrich(raw);
    console.log(`\n[${raw.mlsNumber}] ${raw.neighborhood} · "${raw.remarks.slice(0, 60)}..."`);
    console.log(`   朝向        : ${cell(report.exposure)}`);
    console.log(`   楼层        : ${cell(report.floor)}   总层数: ${cell(report.storeys)}`);
    console.log(`   开窗比例    : ${cell(report.windowExposurePct)}`);
    console.log(`   层高(ft)    : ${cell(report.ceilingHeightFt)}`);
    console.log(`   可养宠      : ${cell(report.petsAllowed)}`);
    console.log(`   阳台        : ${cell(report.balcony)}`);
  }

  console.log("\n\n" + "#".repeat(80));
  console.log("# ② 用「富化后的」数据跑意图搜索：证明排序建立在派生属性之上，而非人工预设");
  console.log("#".repeat(80));
  const enriched = await enrichAll(RAW_LISTINGS);
  const source = new LocalSampleSource(enriched);
  const q = "想要大窗户 采光好 的公寓";
  const r = await search(q, { source, topK: 4 });
  console.log(`\n🔍 "${q}"  →  ${r.plan.intentSummary}`);
  r.results.forEach((res, i) => {
    const l = res.listing;
    console.log(`  ${i + 1}. [${l.mlsNumber}] ${l.neighborhood} 朝${l.exposure ?? "?"} ${l.floor ?? "-"}楼 · 开窗${l.windowExposurePct} · 总分 ${res.score.final.toFixed(3)}`);
    for (const e of res.explanations) if (e.reasons.length) console.log(`       └ ${e.conceptLabel}: ${e.reasons.join("；")}`);
  });
  console.log("\n  → R001(朝南28楼, 落地窗) 登顶；R002(朝北3楼, 虽写 big windows) 沉底——");
  console.log("    注意：这些朝向/楼层/开窗比例都是【从原始 MLS 文本派生】的，不是预先填好的。");
}

main().catch((e) => { console.error(e); process.exit(1); });
