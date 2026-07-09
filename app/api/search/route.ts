import { NextResponse } from "next/server";
import { runSearch, type RunSearchInput, type WebFilters } from "../../../src/web/searchService";

export const dynamic = "force-dynamic";

// Repliers key 只在服务端读取，绝不下发到浏览器。
function apiKeyFor(source: string | undefined): string | undefined {
  return source === "repliers" ? process.env.REPLIERS_API_KEY : undefined;
}

// POST：前端正式调用。body = { filters, intent, source?, topK? }
export async function POST(req: Request) {
  let body: RunSearchInput = {};
  try {
    body = (await req.json()) as RunSearchInput;
  } catch {
    /* 空 body 容错 */
  }
  const result = await runSearch({
    filters: body.filters,
    intent: body.intent,
    source: body.source,
    topK: body.topK,
    apiKey: apiKeyFor(body.source),
  });
  return NextResponse.json(result);
}

// GET：便于浏览器/curl 快速自测，如
// /api/search?intent=采光好 安静&type=sale&minBeds=2
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const num = (k: string) => (q.get(k) ? Number(q.get(k)) : undefined);
  const filters: WebFilters = {
    type: (q.get("type") as WebFilters["type"]) || undefined,
    city: q.get("city") || undefined,
    neighborhood: q.get("neighborhood") || undefined,
    propertyType: q.get("propertyType") || undefined,
    minBeds: num("minBeds"),
    minBaths: num("minBaths"),
    minPrice: num("minPrice"),
    maxPrice: num("maxPrice"),
    minParking: num("minParking"),
  };
  const source = (q.get("source") as RunSearchInput["source"]) || "sample";
  const result = await runSearch({
    filters,
    intent: q.get("intent") ?? "",
    source,
    topK: num("topK") ?? 24,
    apiKey: apiKeyFor(source),
  });
  return NextResponse.json(result);
}
