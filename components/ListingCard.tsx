"use client";

import { useState } from "react";
import type { WebListing } from "@/src/web/searchService";

function money(n: number, type: string) {
  return type === "lease" ? `$${n.toLocaleString()}/月` : `$${n.toLocaleString()}`;
}

export function ListingCard({
  listing,
  onOpen,
  isFavorite,
  onToggleFavorite,
}: {
  listing: WebListing;
  onOpen?: (l: WebListing) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (l: WebListing) => void;
}) {
  const l = listing;
  const [imgOk, setImgOk] = useState(true);
  const pills = l.reasons.flatMap((r) => r.points).slice(0, 3);

  return (
    <article className="group relative">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-neutral-100">
        {imgOk ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.images[0]}
            alt=""
            loading="lazy"
            onError={() => setImgOk(false)}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="grid h-full w-full place-items-center text-sm text-neutral-400">暂无照片</div>
        )}

        <span className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-white/90 px-2 py-0.5 text-xs font-medium text-neutral-700 shadow-sm">
          {l.type === "lease" ? "租" : "买"}
        </span>

        <button
          type="button"
          aria-label={isFavorite ? `取消收藏 ${l.neighborhood}` : `收藏 ${l.neighborhood}`}
          aria-pressed={!!isFavorite}
          onClick={() => onToggleFavorite?.(l)}
          className="absolute right-3 top-3 z-20 grid h-8 w-8 place-items-center rounded-full bg-white/80 shadow-sm transition hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
        >
          <span aria-hidden className={isFavorite ? "text-rose-500" : "text-neutral-600"}>
            {isFavorite ? "♥" : "♡"}
          </span>
        </button>
      </div>

      <div className="mt-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate font-medium text-neutral-900">{l.neighborhood}</p>
          <p className="shrink-0 text-sm text-neutral-400">{l.city}</p>
        </div>
        <p className="mt-0.5 text-sm text-neutral-500">
          {l.beds}房 · {l.baths}卫{l.sqft ? ` · ${l.sqft} sqft` : ""}
        </p>
        <p className="mt-1 font-semibold text-neutral-900">{money(l.price, l.type)}</p>

        {pills.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {pills.map((p, i) => (
              <span key={i} className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700">
                {p}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 覆盖整卡的主操作：可 Tab 聚焦、可回车触发。放在装饰元素之下、收藏按钮之上。 */}
      <button
        type="button"
        data-open-mls={l.mlsNumber}
        onClick={() => onOpen?.(l)}
        className="absolute inset-0 z-10 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2"
      >
        <span className="sr-only">查看 {l.neighborhood} 的房源详情</span>
      </button>
    </article>
  );
}
