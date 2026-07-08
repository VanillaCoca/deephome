// 真实数据测试：用 Repliers API 跑 Deephome 意图搜索。
// 用法： npx tsx demo-repliers.ts     （key 从 .env 或环境变量 REPLIERS_API_KEY 读取）
//
// 注意：免费 Preview/trial 档返回的是【真实结构与全量】数据，但 Repliers 会把文本类字段
// （propertyType / description / sqft / 街道地址）做字符打乱保护，且部分 board 不含 exposure/楼层。
// 因此这个脚本验证的是「管道 + 结构化意图」，采光/景观类意图需要干净数据(付费+牌照)或靠照片富化。

import { search } from "./src/pipeline";
import { RepliersSource } from "./src/sources";

declare const process: any;
declare function require(m: string): any;

function loadKey(): string {
  if (process.env.REPLIERS_API_KEY) return process.env.REPLIERS_API_KEY;
  try {
    const t = require("fs").readFileSync(".env", "utf8");
    const m = t.match(/REPLIERS_API_KEY\s*=\s*(.+)/);
    if (m) return m[1].trim();
  } catch {}
  return "";
}

async function main() {
  const key = loadKey();
  if (!key) { console.error("缺少 REPLIERS_API_KEY（放到 .env 或设为环境变量）"); process.exit(1); }
  const source = new RepliersSource(key);

  const queries = [
    "toronto 两房 condo 预算 60万 近地铁",
    "toronto 采光好的 condo",
  ];

  for (const q of queries) {
    console.log("\n" + "=".repeat(70) + "\n🔍 " + q);
    try {
      const r = await search(q, { source, topK: 5 });
      console.log("计划:", r.plan.intentSummary);
      console.log("硬过滤:", JSON.stringify(r.plan.hardFilters), "| 候选:", r.candidateCount);
      r.results.forEach((res, i) => {
        const l = res.listing;
        console.log(`  ${i + 1}. ${l.neighborhood} · ${l.beds}房 · $${l.price} · 朝${l.exposure ?? "?"} · 分 ${res.score.final.toFixed(3)}  [${l.mlsNumber}]`);
      });
    } catch (e) { console.error("请求失败:", (e as Error).message); }
  }

  console.log("\n" + "-".repeat(70));
  console.log("说明：Preview 档文本字段被打乱、朝向/楼层常缺失，所以结构化意图(房间/预算/地点)");
  console.log("可验证，但采光/景观类意图需要干净数据(付费+牌照)或靠照片富化(RepliersVisionAdapter)。");
}

main();
