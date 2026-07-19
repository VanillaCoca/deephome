import { NextResponse } from "next/server";

// 诊断端点：一眼看清生产环境里各 env 是否到位 + Repliers 实际响应。
// 安全：只返回布尔值 / 名称 / HTTP 状态 / 响应体前若干字符（响应体里不含请求 key），绝不回显任何密钥值。

export const dynamic = "force-dynamic";

export async function GET() {
  const env = {
    REPLIERS_API_KEY: !!process.env.REPLIERS_API_KEY,
    LISTINGS_SOURCE: process.env.LISTINGS_SOURCE ?? null,
    GOOGLE_MAPS_API_KEY: !!(process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY),
    AWS_BEDROCK: !!(process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEDROCK_API_KEY),
    SUPABASE: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
  };

  // 直连 Repliers 打一枪最小请求，报告状态 + 数量 + 报错头部
  let repliers: any = { attempted: false };
  const key = process.env.REPLIERS_API_KEY;
  if (key) {
    try {
      const res = await fetch("https://api.repliers.io/listings?status=A&resultsPerPage=5", {
        headers: { "REPLIERS-API-KEY": key, "Content-Type": "application/json" },
      });
      const text = await res.text();
      let count: number | null = null;
      let totalHint: any = null;
      try {
        const j = JSON.parse(text);
        count = Array.isArray(j.listings) ? j.listings.length : null;
        totalHint = j.count ?? j.total ?? j.numResults ?? null;
      } catch {
        /* 非 JSON（多半是报错 HTML/文本） */
      }
      repliers = { attempted: true, status: res.status, ok: res.ok, count, totalHint, bodyHead: text.slice(0, 240) };
    } catch (e: any) {
      repliers = { attempted: true, error: String(e?.message ?? e) };
    }
  }

  return NextResponse.json({ env, repliers });
}
