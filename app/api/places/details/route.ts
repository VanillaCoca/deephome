import { NextResponse } from "next/server";

// 地点详情（服务端代理）：拿到 place_id 后取经纬度 + 类型，归一成前端可直接用的结果。
//   kind="city"  → 设为区域硬过滤（filters.city）
//   kind="place" → 设为邻近锚点（filters.near = {lat,lng,label}），排序时越近越高

export const dynamic = "force-dynamic";

function key() {
  return process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const placeId = searchParams.get("placeId") || "";
  const token = searchParams.get("token") || "";

  const k = key();
  if (!k) return NextResponse.json({ configured: false });
  if (!placeId) return NextResponse.json({ configured: true, error: "missing placeId" }, { status: 400 });

  const url = new URL("https://maps.googleapis.com/maps/api/place/details/json");
  url.searchParams.set("place_id", placeId);
  url.searchParams.set("key", k);
  url.searchParams.set("fields", "geometry,name,type,formatted_address");
  url.searchParams.set("language", "zh-CN");
  if (token) url.searchParams.set("sessiontoken", token);

  try {
    const res = await fetch(url.toString());
    const data = (await res.json()) as any;
    if (data.status !== "OK") {
      return NextResponse.json({ configured: true, error: data.status ?? "unknown" }, { status: 502 });
    }
    const r = data.result;
    const loc = r.geometry?.location;
    const types: string[] = r.types ?? [];
    // 纯城市/大区域 → 区域过滤；其余（大学/公司/地标/小区）→ 邻近锚点
    const isCity = types.some((t) => ["locality", "administrative_area_level_1", "administrative_area_level_2", "postal_town"].includes(t));
    const label: string = r.name || r.formatted_address || "选定地点";

    if (isCity) {
      return NextResponse.json({ configured: true, kind: "city", label, city: r.name });
    }
    return NextResponse.json({
      configured: true,
      kind: "place",
      label,
      near: loc ? { lat: loc.lat, lng: loc.lng, label } : null,
    });
  } catch (e: any) {
    return NextResponse.json({ configured: true, error: String(e?.message ?? e) }, { status: 500 });
  }
}
