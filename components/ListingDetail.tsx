"use client";

import { useEffect, useRef } from "react";
import type { WebListing } from "@/src/web/searchService";

// 详情层：压入同一舞台，不开新标签、不用阻塞 modal —— 对话全程可用。
// 因为它不是 Dialog，焦点管理需要我们自己负责：进入时聚焦标题，Esc 返回，返回时焦点归位到原卡片。
export function ListingDetail({
  listing,
  backLabel,
  onBack,
}: {
  listing: WebListing;
  backLabel: string;
  onBack: () => void;
}) {
  const l = listing;
  const headingRef = useRef<HTMLHeadingElement>(null);
  const price = l.type === "lease" ? `$${l.price.toLocaleString()}/月` : `$${l.price.toLocaleString()}`;

  // 进入详情时把焦点移到标题，让读屏与键盘用户知道视图变了
  useEffect(() => {
    headingRef.current?.focus();
  }, [l.mlsNumber]);

  // Esc 返回结果
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onBack();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onBack]);

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          ← {backLabel}
          <kbd className="ml-1 rounded border border-neutral-200 px-1 text-[10px] text-neutral-400">Esc</kbd>
        </button>

        {/* 深链是"选择"，不是强制：默认在同舞台看，这里提供新标签/分享入口 */}
        <a
          href={`/listing/${encodeURIComponent(l.mlsNumber)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:text-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          新标签打开 ↗
        </a>
      </div>

      <div className="grid grid-cols-4 gap-2 overflow-hidden rounded-2xl">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={l.images[0]}
          alt={`${l.neighborhood} 房源照片`}
          className="col-span-4 h-[380px] w-full bg-neutral-100 object-cover sm:col-span-3 sm:h-[420px]"
        />
        <div className="hidden grid-rows-2 gap-2 sm:grid">
          {l.images.slice(1, 3).map((src, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={i} src={src} alt="" className="h-full w-full bg-neutral-100 object-cover" />
          ))}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold tracking-tight text-neutral-900 outline-none">
            {l.neighborhood}
          </h2>
          <p className="mt-1 text-neutral-500">
            {l.city} · {l.propertyType || "住宅"} · MLS {l.mlsNumber}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-semibold text-neutral-900">{price}</p>
          <p className="text-sm text-neutral-400">{l.type === "lease" ? "出租" : "出售"}</p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 rounded-2xl border border-neutral-200 p-5 sm:grid-cols-4">
        <Spec label="卧室" value={`${l.beds}`} />
        <Spec label="卫浴" value={`${l.baths}`} />
        <Spec label="面积" value={l.sqft ? `${l.sqft} sqft` : "—"} />
        <Spec label="朝向 / 楼层" value={`${l.exposure ?? "—"}${l.floor ? ` · ${l.floor}楼` : ""}`} />
      </div>

      {l.reasons.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-neutral-700">为什么推荐给你</h3>
          <div className="mt-3 space-y-3">
            {l.reasons.map((r, i) => (
              <div key={i} className="rounded-2xl bg-emerald-50/60 p-4">
                <p className="text-sm font-medium text-emerald-800">{r.concept}</p>
                <ul className="mt-1.5 space-y-1">
                  {r.points.map((p, j) => (
                    <li key={j} className="text-sm text-emerald-700">
                      · {p}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-8 text-xs text-neutral-400">
        提示：详情打开时对话依然可用 —— 试试在左侧说"这个太贵了，有类似但便宜点的吗"。
      </p>
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-neutral-400">{label}</p>
      <p className="mt-0.5 font-medium text-neutral-900">{value}</p>
    </div>
  );
}
