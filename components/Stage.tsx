"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { WebListing, WebSearchResult } from "@/src/web/searchService";
import { Badge } from "@/components/ui/badge";
import { ListingCard } from "@/components/ListingCard";
import { ListingDetail } from "@/components/ListingDetail";

// 舞台：一个对象，随任务演化 —— 条件 → 结果 → 详情。永不出现第二份。
export function Stage({
  result,
  detail,
  onOpen,
  onBack,
  isHistorical,
  favorites,
  onToggleFavorite,
  versionKey,
}: {
  result: WebSearchResult;
  detail: WebListing | null;
  onOpen: (l: WebListing) => void;
  onBack: () => void;
  isHistorical: boolean;
  favorites: Set<string>;
  onToggleFavorite: (l: WebListing) => void;
  versionKey: number;
}) {
  const conceptChips = Array.from(new Set(result.results.flatMap((r) => r.reasons.map((x) => x.concept))));
  const f = result.filters ?? {};

  return (
    <AnimatePresence mode="wait" initial={false}>
      {detail ? (
        // ---------- S2 · 详情层：压入同一舞台 ----------
        <motion.div
          key={`detail-${detail.mlsNumber}`}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-5xl px-5 py-6 sm:px-8"
        >
          <ListingDetail listing={detail} backLabel={`返回 ${result.count} 个结果`} onBack={onBack} />
        </motion.div>
      ) : (
        // ---------- S1 · 结果 ----------
        <motion.div
          key="grid"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="mx-auto max-w-6xl px-5 py-6 sm:px-8"
        >
          {/* 吸顶 header：当前条件 + 命中数 + 排序 */}
          <div className="sticky top-0 z-10 -mx-5 mb-6 border-b border-neutral-100 bg-neutral-50/80 px-5 pb-4 pt-5 backdrop-blur sm:-mx-8 sm:px-8">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-lg font-semibold text-neutral-900">{result.count} 套</span>
              <span className="text-sm text-neutral-400">· 按意图排序</span>
              {isHistorical && (
                <Badge variant="secondary" className="bg-amber-50 text-amber-700">
                  正在查看历史版本
                </Badge>
              )}
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {f.type && <Badge variant="outline">{f.type === "lease" ? "租" : "买"}</Badge>}
              {f.city && <Badge variant="outline">{f.city}</Badge>}
              {f.propertyType && <Badge variant="outline">{f.propertyType}</Badge>}
              {f.minBeds ? <Badge variant="outline">{f.minBeds}+ 房</Badge> : null}
              {f.minBaths ? <Badge variant="outline">{f.minBaths}+ 卫</Badge> : null}
              {f.maxPrice ? <Badge variant="outline">≤ ${f.maxPrice.toLocaleString()}</Badge> : null}
              {conceptChips.map((c) => (
                <Badge key={c} variant="secondary" className="bg-emerald-50 text-emerald-700">
                  {c}
                </Badge>
              ))}
            </div>
          </div>

          {result.results.length === 0 ? (
            <p className="py-24 text-center text-neutral-400">没有符合条件的房源，换个说法试试。</p>
          ) : (
            // 每换一版结果，整组卡片重新淡入 —— 让"原地更新"看得见
            <div key={versionKey} className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
              {result.results.map((l, i) => (
                <motion.div
                  key={l.mlsNumber}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24, delay: Math.min(i * 0.025, 0.25), ease: [0.22, 1, 0.36, 1] }}
                >
                  <ListingCard
                    listing={l}
                    onOpen={onOpen}
                    isFavorite={favorites.has(l.mlsNumber)}
                    onToggleFavorite={onToggleFavorite}
                  />
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
