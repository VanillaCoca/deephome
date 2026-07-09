// 对话代理（服务端）：Sonnet + search_listings 工具循环。
// 关键契约：**文字进对话，结果进舞台**。工具结果只回传「摘要」给模型，
// 从机制上阻止它在气泡里逐条列房源（见 UX_SPEC 的"明令禁止"）。

import { bedrockChat, textOf, toolUsesOf, type BedrockMessage } from "./bedrock";
import { runSearch, type WebSearchResult, type WebFilters } from "./searchService";

export interface TurnMessage {
  role: "user" | "assistant";
  text: string;
}

const SYSTEM = `你是 Deephome 的找房助手（多伦多）。你的任务是通过对话理解用户的【真实意图】——而不只是字面关键词——然后调用 search_listings 工具搜索。

要点：
1. 用户说的词往往只是意图的代理。例如"大窗户"通常真正想要的是"采光好"，但也可能是"景观好"或"空间感"。**只有当意图实质分叉时**才追问一句澄清；否则直接搜，不要啰嗦。
2. 调用工具时，把【软性意图】放进 intent（自由文本，如"采光好 安静 能养狗"），把【硬约束】放进各自字段（type / minBeds / minBaths / maxPrice / city…）。不要把"两房""预算80万"塞进 intent。
3. 【非常重要】搜索结果会显示在用户右侧的舞台上。**绝不要在回复里逐条列出房源**。用一两句话概括，可以点名其中一两套（例如"最亮的是 Liberty Village 那套，朝南 28 楼"），并说明你是按什么排序的。
4. 用户 refine 时（"便宜点""再安静些""换成租的"），重新调用工具，带上累积后的完整条件。
5. 中文回复，简洁、专业、温和。不用 emoji。回复控制在 2-3 句。`;

const SEARCH_TOOL = {
  name: "search_listings",
  description:
    "按用户意图搜索房源。软性意图放 intent（自由文本），硬约束放各自字段。结果会自动显示在用户界面的右侧舞台，你不需要在文字里列出它们。",
  input_schema: {
    type: "object",
    properties: {
      intent: {
        type: "string",
        description: "用户的软性意图，中文自由文本，如 '采光好 安静 能养狗'。不要包含卧室数、预算等硬条件。",
      },
      type: { type: "string", enum: ["sale", "lease"], description: "买(sale) 或 租(lease)" },
      city: { type: "string" },
      neighborhood: { type: "string" },
      propertyType: { type: "string", description: "如 'Condo Apt' / 'Detached' / 'Townhouse'" },
      minBeds: { type: "number" },
      minBaths: { type: "number" },
      maxPrice: { type: "number" },
      minParking: { type: "number" },
    },
    required: ["intent"],
  },
};

// 只把摘要喂回模型：够它开口概括，但不足以让它复制整个列表。
function summaryForModel(r: WebSearchResult) {
  return {
    count: r.count,
    intent_understood: r.intent.summary,
    filters_applied: r.filters,
    top_3: r.results.slice(0, 3).map((l) => ({
      mls: l.mlsNumber,
      neighborhood: l.neighborhood,
      price: l.price,
      type: l.type,
      beds: l.beds,
      exposure: l.exposure,
      floor: l.floor,
      why: l.reasons.flatMap((x) => x.points).slice(0, 3),
    })),
    reminder: "结果已显示在用户右侧舞台。不要逐条列出房源，用一两句话概括即可。",
  };
}

export interface ChatTurnResult {
  text: string;
  search: WebSearchResult | null;
  fallback?: boolean; // 未配置 Bedrock key 时，退回确定性引擎
}

export async function chatTurn(input: {
  history: TurnMessage[];
  userText: string;
  defaultType?: "sale" | "lease";
  useLLM?: boolean; // false = 强制走确定性引擎（未登录用户 / 成本闸门）
}): Promise<ChatTurnResult> {
  // 优雅降级：没有 Bedrock key、或调用方不允许用 LLM 时，把原文交给确定性意图引擎。
  // 这正是"LLM 可插拔、KB 才是核心"的架构红利 —— 匿名用户依然拿到完整的意图搜索。
  const hasKey = Boolean(process.env.AWS_BEARER_TOKEN_BEDROCK);
  const useLLM = hasKey && input.useLLM !== false;

  if (!useLLM) {
    const r = await runSearch({
      intent: input.userText,
      filters: input.defaultType ? ({ type: input.defaultType } as WebFilters) : {},
      topK: 24,
    });
    const note = !hasKey
      ? "（未配置 Bedrock key，当前由确定性规则引擎理解意图）"
      : "（登录后可启用 AI 对话理解；当前由确定性规则引擎理解意图）";
    return {
      text: r.count ? `${r.intent.summary || ""} 我在右侧列出了 ${r.count} 套。${note}`.trim() : `没有符合条件的房源，换个说法试试？${note}`,
      search: r,
      fallback: true,
    };
  }

  const messages: BedrockMessage[] = [
    ...input.history.map((m) => ({ role: m.role, content: m.text })),
    { role: "user" as const, content: input.userText },
  ];

  const system = input.defaultType
    ? `${SYSTEM}\n\n当前界面上的买/租开关是：${input.defaultType === "lease" ? "租(lease)" : "买(sale)"}。用户没有明说时以此为准。`
    : SYSTEM;

  // 第一跳：模型决定是否调用工具
  const first = await bedrockChat({ system, messages, tools: [SEARCH_TOOL], maxTokens: 1024 });
  const uses = toolUsesOf(first);

  if (uses.length === 0) {
    return { text: textOf(first) || "能再多说一点你的偏好吗？", search: null };
  }

  // 执行工具
  let search: WebSearchResult | null = null;
  const toolResults: any[] = [];
  for (const u of uses) {
    if (u.name === "search_listings") {
      const { intent, ...rest } = (u.input ?? {}) as { intent?: string } & WebFilters;
      const r = await runSearch({ intent: intent ?? "", filters: rest as WebFilters, topK: 24 });
      search = r;
      toolResults.push({ type: "tool_result", tool_use_id: u.id, content: JSON.stringify(summaryForModel(r)) });
    } else {
      toolResults.push({ type: "tool_result", tool_use_id: u.id, content: "未知工具", is_error: true });
    }
  }

  // 第二跳：把工具结果喂回，让模型收尾说话
  const second = await bedrockChat({
    system,
    messages: [...messages, { role: "assistant", content: first.content }, { role: "user", content: toolResults }],
    tools: [SEARCH_TOOL],
    maxTokens: 600,
  });

  const text =
    textOf(second) ||
    (search && search.count ? `我在右侧列出了 ${search.count} 套。` : "没有符合条件的房源，换个说法试试？");

  return { text, search };
}
