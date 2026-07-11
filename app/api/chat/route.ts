import { NextResponse } from "next/server";
import { chatTurn, type TurnMessage, type FocusedListing } from "../../../src/web/chatAgent";
import type { WebFilters } from "../../../src/web/searchService";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Gate = { useLLM: boolean; note?: string };

const NOTE_ANON = "（登录后可启用 AI 对话理解；当前由确定性规则引擎理解意图）";
const NOTE_QUOTA = "（今日 AI 对话额度已用完，明日恢复；当前由确定性规则引擎理解意图）";

// 成本闸门（生产设 LLM_REQUIRES_AUTH=true）：
//   匿名 → 确定性引擎（免费，功能完整）
//   登录 → 消费每日额度；超额后同样降级为确定性引擎，而不是报错
// 额度消费走 Postgres 的 security definer 函数：用户无法篡改自己的计数。
async function gate(): Promise<Gate> {
  if (process.env.LLM_REQUIRES_AUTH !== "true") return { useLLM: true };

  const supabase = createClient();
  if (!supabase) return { useLLM: false, note: NOTE_ANON }; // 要求登录却没配 Supabase → 保守降级

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return { useLLM: false, note: NOTE_ANON };

  const limit = Number(process.env.LLM_DAILY_LIMIT ?? 50);
  const { data, error } = await supabase.rpc("consume_llm_quota", { p_limit: limit });
  if (error) return { useLLM: false, note: NOTE_QUOTA }; // 计数异常时宁可降级，也不放开花钱

  const row: any = Array.isArray(data) ? data[0] : data;
  return row?.allowed ? { useLLM: true } : { useLLM: false, note: NOTE_QUOTA };
}

// POST { messages: TurnMessage[], text: string, type?: "sale"|"lease" }
// →    { text: string, search: WebSearchResult | null, fallback?: boolean }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      messages?: TurnMessage[];
      text?: string;
      type?: "sale" | "lease";
      focused?: FocusedListing | null;
      filters?: WebFilters | null;
    };
    if (!body.text?.trim()) return NextResponse.json({ error: "缺少 text" }, { status: 400 });

    const g = await gate();
    const out = await chatTurn({
      history: (body.messages ?? []).slice(-12), // 只带最近若干轮，控制 token
      userText: body.text.trim(),
      defaultType: body.type,
      focused: body.focused ?? null,
      baseFilters: body.filters ?? null,
      useLLM: g.useLLM,
      fallbackNote: g.note,
    });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
