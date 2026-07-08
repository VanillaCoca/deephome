# Deephome 意图搜索引擎（原型）

把用户的**表层搜索词**还原成**真实意图**，再翻译成**可查询的房源属性**，并全程可解释、可纠错。

> "想要大窗户" 的真实意图往往是 "采光好"，而采光好由 **朝向 / 楼层 / 遮挡 / 开窗比例** 决定——
> 这些用户从没提过。传统搜索匹配字面词，Deephome 匹配意图。

完整设计与推理见 **[`DESIGN.md`](./DESIGN.md)**。

---

## 快速运行（离线、零 key、零依赖）

```bash
cd deephome-claude

# 方式 A：tsx（若本机 tsx 可用）
npx tsx demo.ts

# 方式 B：用仓库自带的 tsc 编译后运行（最稳）
npm run build:run
#   等价于：
#   npx tsc demo.ts src/globals.d.ts --outDir dist --module commonjs \
#       --target es2020 --moduleResolution node --skipLibCheck --esModuleInterop
#   node dist/demo.js

# 自定义查询
npx tsx demo.ts "养狗 安静 近地铁 一房 预算80万"
```

演示会打印：**意图帧 → 查询计划 → 排序结果（含每套房的"为什么"）**，
并用一个"朴素关键词搜索 vs Deephome 意图搜索"的对比，证明字面命中 ≠ 最优匹配。

---

## 接入真实 LLM（生产的意图理解前端）

意图引擎的 LLM 是**可插拔**的。实现一个 `LLMAdapter` 注入即可，KB 依然掌管"意图→属性"：

```ts
import { search } from "./src/pipeline";
import type { LLMAdapter } from "./src/llm";

const claude: LLMAdapter = {
  async complete(prompt) {
    const r = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });
    return r.content[0].type === "text" ? r.content[0].text : "";
  },
};

const result = await search("想要大窗户 采光好 的公寓", { llm: claude });
```

不传 `llm` 时自动走**确定性回退**（基于 KB 线索词），无需任何 key 也能跑。

---

## 接入真实房源数据（Repliers）

数据源也是可插拔的（`ListingSource`）。真实房源需 Repliers key + MLS 授权：

```ts
import { search } from "./src/pipeline";
import { RepliersSource } from "./src/sources";

const source = new RepliersSource(process.env.REPLIERS_API_KEY!);
const result = await search("安静 近地铁 一房", { source });
```

- 免费 **Preview 档**：可跑通全流程，但只对 **sample data**（适合搭建/验证意图引擎）。
- 真实在售/在租房源：需 **Standard（$199/月）+ 牌照授权**。

---

## 目录结构

```
deephome-claude/
├── DESIGN.md            设计文档（第一性原理 + 市场对标 + 最优方案论证）
├── demo.ts              可运行演示
└── src/
    ├── types.ts         核心数据模型
    ├── intentKB.ts      ★ 意图知识库（产品核心资产：意图 → 属性 映射）
    ├── intentEngine.ts  意图理解（LLM 前端 + 确定性回退）
    ├── llm.ts           LLM 适配器接口 + grounding prompt
    ├── planner.ts       意图帧 → 查询计划
    ├── sources.ts       数据源接口 + 本地/Repliers 适配器
    ├── ranking.ts       混合打分 + 透明融合 + 解释生成
    ├── pipeline.ts      端到端编排
    └── sampleData.ts    14 套多伦多样例房源
```

## 设计要点（一句话版）

- **核心资产是意图知识库**，不是一段 prompt。它可审计、可改进、可解释。
- **LLM 做模糊映射，KB 做属性展开**：兼得灵活性与可控性。
- **混合检索**（结构化 + 文本 + 图片 + 地点）：单一信号覆盖不全一个意图。
- **透明线性排序**：可解释是灵魂，黑盒 rerank 只做可选精修。
- **数据源 / LLM 全可插拔**：先用免费档证明价值，再决定是否上真实房源。

---

## 富化管线 (Layer 0) —— 让意图能落在真实 MLS 上

意图排序依赖 `exposure / floor / windowExposurePct / ceilingHeightFt / petsAllowed` 等字段，
但真实 MLS 只稳定给一部分。`src/enrich.ts` 负责把**原始 MLS(remarks + 基础字段 + 图片标签)**
派生成完整的可意图化房源，且**每个派生字段都带来源与置信度**(provenance)，延续可解释基因。

```bash
npx tsx demo-enrich.ts     # 展示 原始MLS → 富化(带来源/置信度) → 意图排序仍成立
```

- 确定性文本抽取器（正则/关键词）：朝向、层高、可养宠、开窗比例、阳台——现在就能离线跑。
- 视觉/LLM 抽取做成可插拔接口 `VisionAdapter`：生产接 Repliers Image Insights 覆盖开窗比例估计。

新增文件：`src/enrich.ts`(富化管线)、`src/rawSample.ts`(原始MLS样例)、`demo-enrich.ts`(演示)。
