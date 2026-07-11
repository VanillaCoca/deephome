"use client";

import { useEffect, useRef, useState } from "react";
import { MapPinIcon, ChevronDownIcon, SearchIcon, XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

// 前端选中的地点：city → 区域硬过滤；near → 邻近锚点（越近越高）
export interface SelectedPlace {
  label: string;
  city?: string;
  near?: { lat: number; lng: number; label: string };
}

interface Suggestion {
  placeId: string;
  primary: string;
  secondary: string;
  isPlace: boolean;
}

function newToken() {
  try {
    return crypto.randomUUID();
  } catch {
    return Math.random().toString(36).slice(2);
  }
}

export function LocationPill({
  place,
  onChange,
  openKey,
  setOpenKey,
}: {
  place: SelectedPlace | null;
  onChange: (p: SelectedPlace | null) => void;
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const open = openKey === "loc";
  const [q, setQ] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const token = useRef(newToken());

  // 点外部关闭
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpenKey(null);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, setOpenKey]);

  // 输入防抖 → 拉联想
  useEffect(() => {
    if (!open) return;
    const s = q.trim();
    if (s.length < 2) {
      setSuggestions([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/places/autocomplete?q=${encodeURIComponent(s)}&token=${token.current}`);
        const data = await res.json();
        setConfigured(data.configured);
        setSuggestions(data.suggestions ?? []);
      } catch {
        setSuggestions([]);
      } finally {
        setLoading(false);
      }
    }, 220);
    return () => clearTimeout(t);
  }, [q, open]);

  async function pick(s: Suggestion) {
    try {
      const res = await fetch(`/api/places/details?placeId=${encodeURIComponent(s.placeId)}&token=${token.current}`);
      const data = await res.json();
      if (data.kind === "city" && data.city) {
        onChange({ label: data.label, city: data.city });
      } else if (data.near) {
        onChange({ label: data.label, near: data.near });
      } else {
        onChange({ label: s.primary, city: s.primary }); // 兜底
      }
    } catch {
      onChange({ label: s.primary, city: s.primary });
    }
    token.current = newToken(); // 结束一个 session，重置计费 token
    setQ("");
    setSuggestions([]);
    setOpenKey(null);
  }

  // 未配置 key 时：回车直接把输入当城市名
  function submitRaw() {
    const s = q.trim();
    if (!s) return;
    onChange({ label: s, city: s });
    setQ("");
    setOpenKey(null);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenKey(open ? null : "loc")}
        className={cn(
          "flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm backdrop-blur transition",
          place
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-200 bg-white/70 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
        )}
      >
        <MapPinIcon className="h-3.5 w-3.5" />
        <span className="max-w-[10rem] truncate">{place ? place.label : "地点"}</span>
        {place ? (
          <XIcon
            className="h-3.5 w-3.5 opacity-70 hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation();
              onChange(null);
            }}
          />
        ) : (
          <ChevronDownIcon className={cn("h-3.5 w-3.5 opacity-60 transition", open && "rotate-180")} />
        )}
      </button>

      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-2 w-72 -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-2 text-left shadow-xl">
          <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2">
            <SearchIcon className="h-4 w-4 shrink-0 text-neutral-400" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key !== "Enter") return;
                if (suggestions[0]) pick(suggestions[0]);
                else submitRaw();
              }}
              placeholder='城市 / 小区，或"离…近"(大学、公司)'
              className="w-full bg-transparent text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
            />
          </div>

          <div className="mt-1.5 max-h-64 overflow-y-auto">
            {loading && <p className="px-3 py-2 text-xs text-neutral-400">搜索中…</p>}

            {!loading &&
              suggestions.map((s) => (
                <button
                  key={s.placeId}
                  type="button"
                  onClick={() => pick(s)}
                  className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left transition hover:bg-neutral-50"
                >
                  <MapPinIcon className={cn("mt-0.5 h-4 w-4 shrink-0", s.isPlace ? "text-emerald-500" : "text-neutral-400")} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm text-neutral-900">{s.primary}</span>
                    {s.secondary && <span className="block truncate text-xs text-neutral-400">{s.secondary}</span>}
                    {s.isPlace && <span className="text-[11px] text-emerald-600">离这儿近 →</span>}
                  </span>
                </button>
              ))}

            {!loading && configured === false && (
              <p className="px-3 py-2 text-xs text-neutral-400">
                未配置地点服务 · 直接输入城市名后回车即可按城市搜索
              </p>
            )}
            {!loading && configured !== false && q.trim().length >= 2 && suggestions.length === 0 && (
              <p className="px-3 py-2 text-xs text-neutral-400">没有匹配的地点</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
