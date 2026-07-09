// P1 验证：不经 UI/Next，直接调 runSearch，打印结果。用法：npx tsx web-search-test.ts
import { runSearch, type WebFilters } from "./src/web/searchService";

async function one(label: string, filters: WebFilters, intent: string) {
  const r = await runSearch({ filters, intent, topK: 4 });
  console.log("\n=== " + label + " ===");
  console.log("意图:", r.intent.summary || "(无)");
  console.log("候选:", r.count, "| 数据源:", r.source);
  r.results.forEach((x, i) => {
    console.log(`  ${i + 1}. ${x.neighborhood} · ${x.type === "lease" ? "租" : "买"} · ${x.beds}房${x.baths}卫 · $${x.price} · 朝${x.exposure ?? "?"} · 分${x.score}`);
    x.reasons.forEach((rn) => console.log(`       └ ${rn.concept}: ${rn.points.join("；")}`));
    console.log(`       图: ${x.images[0]}`);
  });
}

async function main() {
  await one("买 · 2房 · 采光好安静", { type: "sale", minBeds: 2, propertyType: "Condo Apt" }, "采光好 安静");
  await one("租 · 1房 · 近地铁养狗", { type: "lease", minBeds: 1 }, "近地铁 能养狗");
  await one("只有 filter · 3房2卫", { minBeds: 3, minBaths: 2 }, "");
}
main();
