import { NextResponse } from "next/server";
import { chatTurn, type TurnMessage } from "../../../src/web/chatAgent";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// 成本闸门：生产环境设 LLM_REQUIRES_AUTH=true，未登录用户走确定性引擎（免费），
// 登录用户才消耗 Bedrock credits。搜索本身对所有人开放。
async function llmAllowed(): Promise<boolean> {
  if (process.env.LLM_REQUIRES_AUTH !== "true") return true;
  const supabase = createClient();
  if (!supabase) return false; // 要求登录却没配 Supabase → 保守拒绝
  const { data } = await supabase.auth.getUser();
  return Boolean(data.user);
}

// POST { messages: TurnMessage[], text: string, type?: "sale"|"lease" }
// →    { text: string, search: WebSearchResult | null, fallback?: boolean }
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { messages?: TurnMessage[]; text?: string; type?: "sale" | "lease" };
    if (!body.text?.trim()) return NextResponse.json({ error: "缺少 text" }, { status: 400 });

    const out = await chatTurn({
      history: (body.messages ?? []).slice(-12), // 只带最近若干轮，控制 token
      userText: body.text.trim(),
      defaultType: body.type,
      useLLM: await llmAllowed(),
    });
    return NextResponse.json(out);
  } catch (e: any) {
    return NextResponse.json({ error: String(e?.message ?? e) }, { status: 500 });
  }
}
