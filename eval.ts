// 评测台：量化每次改动对排序质量的影响。
// 用法：
//   npx tsx eval.ts            跑评测(NDCG@5)，若有基线则显示 Δ
//   npx tsx eval.ts --save     把当前结果存为基线(eval/baseline.json)
// 工作流：先 --save 建基线 → 改 KB/权重/视觉 → 再跑本命令看变好还是变差。
import { runEval, type SuiteResult } from "./eval/harness";

declare const process: any;
declare function require(m: string): any;

const BASELINE = "eval/baseline.json";
const bar = (x: number, n = 24) => "█".repeat(Math.round(x * n)).padEnd(n, "·");

async function main() {
  const save = process.argv.includes("--save");
  const res = await runEval({ k: 5 });

  console.log("评测 NDCG@5（金标评委 · 样例数据）:\n");
  for (const c of res.cases) {
    console.log(`  ${bar(c.ndcg)} ${c.ndcg.toFixed(3)}  ${c.id}  «${c.query}»`);
    console.log(`       排序: ${c.top.map((t) => `${t.mls}(${t.grade})`).join(" ")}`);
  }
  console.log(`\n  ▶ 平均 NDCG@5 = ${res.meanNdcg.toFixed(4)}`);

  const fs = require("fs");
  if (save) {
    fs.mkdirSync("eval", { recursive: true });
    fs.writeFileSync(BASELINE, JSON.stringify(res, null, 2));
    console.log(`\n已保存基线 → ${BASELINE}`);
    return;
  }
  try {
    const base: SuiteResult = JSON.parse(fs.readFileSync(BASELINE, "utf8"));
    const d = res.meanNdcg - base.meanNdcg;
    const tag = d > 1e-9 ? "↑ 变好" : d < -1e-9 ? "↓ 变差" : "= 持平";
    console.log(`\n对比基线: ${base.meanNdcg.toFixed(4)} → ${res.meanNdcg.toFixed(4)}  (Δ ${d >= 0 ? "+" : ""}${d.toFixed(4)} ${tag})`);
    for (const c of res.cases) {
      const b = base.cases.find((x) => x.id === c.id);
      if (b && Math.abs(c.ndcg - b.ndcg) > 1e-9) {
        const dd = c.ndcg - b.ndcg;
        console.log(`   · ${c.id}: ${b.ndcg.toFixed(3)} → ${c.ndcg.toFixed(3)} (${dd > 0 ? "+" : ""}${dd.toFixed(3)})`);
      }
    }
  } catch {
    console.log(`\n(无基线。先跑 \`npx tsx eval.ts --save\` 建基线，之后每次改动再跑本命令看 Δ。)`);
  }
}
main();
