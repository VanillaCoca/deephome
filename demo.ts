// Deephome 意图引擎 —— 可运行 demo。
// 用法： npx tsx demo.ts            (跑全部演示)
//       npx tsx demo.ts "养狗 安静 近地铁 2房 预算80万"   (自定义 query)
//
// 默认走离线样例数据 + 确定性意图引擎，零依赖、无需任何 API key。
// 接真实 LLM / Repliers 的方法见 README。

import { search } from "./src/pipeline";
import { SAMPLE_LISTINGS } from "./src/sampleData";
import type { ScoredListing } from "./src/types";

const bar = (x: number, n = 20) => "█".repeat(Math.round(x * n)).padEnd(n, "·");
const money = (n: number) => (n >= 100000 ? `$${(n / 1000).toFixed(0)}k` : `$${n}/mo`);

function printResult(r: ScoredListing, rank: number) {
  const l = r.listing;
  console.log(
    `  ${rank}. [${l.mlsNumber}] ${l.neighborhood} · ${l.propertyType} · ${l.beds}房 · ${money(l.price)} · ` +
      `朝${l.exposure ?? "?"}${l.floor ? ` · ${l.floor}楼` : ""}`,
  );
  console.log(
    `     总分 ${bar(r.score.final)} ${r.score.final.toFixed(3)}  ` +
      `[结构${r.score.structured.toFixed(2)} 文本${r.score.text.toFixed(2)} 图${r.score.image.toFixed(2)} 地点${r.score.places.toFixed(2)}]`,
  );
  for (const e of r.explanations) {
    if (e.reasons.length) console.log(`     └ ${e.conceptLabel}: ${e.reasons.join("；")}`);
  }
}

// 朴素关键词基线：把「大窗户」按字面翻成英文短语，在 remarks+标签里数命中次数排序。
// 这就是传统搜索（含 Repliers /nlp 这类字面参数抽取）会做的事——只认字面词。
function naive(topK = 3) {
  const phrases = ["big windows", "large windows", "floor-to-ceiling windows"];
  return SAMPLE_LISTINGS.map((l) => {
    const hay = (l.remarks + " " + l.photoTags.join(" ")).toLowerCase();
    const hits = phrases.reduce((n, p) => n + (hay.split(p).length - 1), 0);
    return { l, hits };
  })
    .filter((x) => x.hits > 0)
    .sort((a, b) => b.hits - a.hits)
    .slice(0, topK);
}

async function runQuery(query: string, topK = 3) {
  console.log("\n" + "=".repeat(78));
  console.log(`🔍 查询: "${query}"`);
  console.log("=".repeat(78));
  const r = await search(query, { topK });

  console.log("\n① 意图理解 (Intent Frame):");
  for (const it of r.frame.items) {
    if (it.kind === "literal") console.log(`   · 字面约束: ${JSON.stringify(it.literal)}`);
    else
      console.log(
        `   · ${it.kind === "intent" ? "意图" : "未知"}「${it.surface}」→ ${it.conceptId ?? "novel"} ` +
          `(${it.polarity === -1 ? "避免" : "想要"}/${it.hardness}/权重${it.weight})`,
      );
  }
  if (r.frame.clarifications.length) {
    console.log("\n   ⚠ 需要澄清:");
    for (const c of r.frame.clarifications) {
      console.log(`     「${c.itemSurface}」— ${c.question}`);
      c.options.forEach((o, i) => console.log(`        (${i + 1}) ${o.label} → ${o.conceptId}`));
    }
  }

  console.log(`\n② 查询计划: ${r.plan.intentSummary}`);
  if (Object.keys(r.plan.hardFilters).length) console.log(`   硬过滤: ${JSON.stringify(r.plan.hardFilters)}`);

  console.log(`\n③ 排序结果 (候选 ${r.candidateCount} 套, 取前 ${topK}):`);
  r.results.forEach((res, i) => printResult(res, i + 1));
}

async function main() {
  const custom = process.argv[2];
  if (custom) {
    await runQuery(custom, 5);
    return;
  }

  console.log("\n" + "#".repeat(78));
  console.log("# 对比演示：用户搜「大窗户 采光好」");
  console.log("#".repeat(78));
  const q = "想要大窗户 采光好 的公寓";
  console.log("\n【朴素关键词搜索】按 'big windows' 字面命中排序：");
  naive().forEach(({ l, hits }, i) =>
    console.log(
      `  ${i + 1}. [${l.mlsNumber}] ${l.neighborhood} 朝${l.exposure} ${l.floor ?? "-"}楼 (字面命中${hits}) — "${l.remarks.slice(0, 42)}..."`,
    ),
  );
  console.log("\n  → 注意 C002：字面写着 'big windows' 排第一，但它朝北+3楼，采光其实很差。");
  await runQuery(q, 3);
  console.log("\n  → Deephome 把「大窗户」还原为「采光好」，用 朝向/楼层/开窗比例 重排，");
  console.log("    朝南高层的 C001/C010 上位，朝北低层的 C002 沉底。这就是意图搜索的价值。");

  await runQuery("安静 近地铁 的一房", 3);
  await runQuery("适合小孩的家庭 独立屋 leslieville", 3);
  await runQuery("养狗 高性价比 公寓", 3);
  await runQuery("高层 景观好 yorkville", 3);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
