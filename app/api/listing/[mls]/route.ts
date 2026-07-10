import { NextResponse } from "next/server";
import { LocalSampleSource, RepliersSource } from "../../../../src/sources";
import { photoUrls } from "../../../../src/web/searchService";

export const dynamic = "force-dynamic";

// 按 MLS 号取单套房源（供 /listing/[mls] 深链页用）。sample 默认；repliers 需 key。
export async function GET(_req: Request, { params }: { params: { mls: string } }) {
  const useRepliers = process.env.LISTINGS_SOURCE === "repliers" && process.env.REPLIERS_API_KEY;
  const source = useRepliers ? new RepliersSource(process.env.REPLIERS_API_KEY!) : new LocalSampleSource();

  // 复用 search 的硬过滤能力做个宽查询，再在结果里挑出该 mls
  const all = await source.search({});
  const l = all.find((x) => x.mlsNumber === params.mls);
  if (!l) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    mlsNumber: l.mlsNumber,
    type: l.type,
    propertyType: l.propertyType,
    city: l.city,
    neighborhood: l.neighborhood,
    lat: l.lat,
    lng: l.lng,
    price: l.price,
    beds: l.beds,
    baths: l.baths,
    sqft: l.sqft,
    exposure: l.exposure,
    floor: l.floor,
    reasons: [],
    images: photoUrls(l),
  });
}
