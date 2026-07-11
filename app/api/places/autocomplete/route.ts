import { NextResponse } from "next/server";

// 地点联想（服务端代理）：把 Google Places Autocomplete 挡在服务端，key 绝不下发浏览器。
// 未配置 GOOGLE_MAPS_API_KEY 时返回 { configured:false }，前端优雅降级为纯文本城市输入。
// 限定加拿大（components=country:ca）—— 产品就是多伦多/加拿大，减噪。

export const dynamic = "force-dynamic";

export interface PlaceSuggestion {
  placeId: string;
  primary: string; // 主名，如「University of Toronto」
  secondary: string; // 次要说明，如「Toronto, ON, Canada」
  isPlace: boolean; // true=具体地点(大学/公司/地标)→邻近锚点；false=城市/区域→区域过滤
}

function key() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = (searchParams.get("q") || "").trim();
  const token = searchParams.get("token") || "";

  const k = key();
  if (!k) return NextResponse.json({ configured: false, suggestions: [] });
  if (q.length < 2) return NextResponse.json({ configured: true, suggestions: [] });

  const url = new URL("https://maps.googleapis.com/maps/api/place/autocomplete/json");
  url.searchParams.set("input", q);
  url.searchParams.set("key", k);
  url.searchParams.set("components", "country:ca");
  url.searchParams.set("language", "zh-CN");
  if (token) url.searchParams.set("sessiontoken", token);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as any;
    if (data.status && data.status !== "OK" && data.status !== "ZERO_RESULTS") {
      return NextResponse.json({ configured: true, suggestions: [], error: data.status });
    }
    const suggestions: PlaceSuggestion[] = (data.predictions ?? []).slice(0, 6).map((p: any) => {
      const types: string[] = p.types ?? [];
      const isArea = types.some((t) => ["locality", "administrative_area_level_1", "administrative_area_level_2", "country", "postal_code"].includes(t));
      return {
        placeId: p.place_id,
        primary: p.structured_formatting?.main_text ?? p.description,
        secondary: p.structured_formatting?.secondary_text ?? "",
        isPlace: !isArea, // 非纯区域（含 establishment / neighborhood）→ 当作可锚定的地点
      };
    });
    return NextResponse.json({ configured: true, suggestions });
  } catch (e: any) {
    return NextResponse.json({ configured: true, suggestions: [], error: String(e?.message ?? e) });
  }
}
