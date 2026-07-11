"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpIcon, ArrowRightIcon, ChevronDownIcon, CheckIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WebFilters } from "@/src/web/searchService";
import { LocationPill, type SelectedPlace } from "./LocationPill";

// 首页轮播打字的占位示例
const PLACEHOLDERS = [
  "采光好、安静、最好能养狗",
  "预算 80 万，想要高层看得远",
  "上班方便，走路能到地铁",
  "适合小孩，学区好一点",
];

// 「表层词 → 真实意图 → 属性」的演示序列（Deephome 的灵魂）
const TEASES = [
  { surface: "大窗户", intent: "采光好", attrs: ["朝南", "高层", "开窗比例大"] },
  { surface: "安静", intent: "远离喧嚣", attrs: ["避开主干道", "无夜生活", "高楼层"] },
  { surface: "想养狗", intent: "宠物友好", attrs: ["允许养宠", "近公园"] },
  { surface: "上班方便", intent: "通勤好", attrs: ["近地铁", "步行可达"] },
];

const EXAMPLES = ["采光好的两房", "安静 · 近地铁", "能养狗 · 高性价比", "高层 · 景观好"];

// 房型：值需与数据源一致（Repliers / 样例都用这些英文字段），label 给中文短名
const PROPERTY_TYPES: { label: string; value: string }[] = [
  { label: "公寓", value: "Condo Apt" },
  { label: "独立屋", value: "Detached" },
  { label: "联排", value: "Townhouse" },
  { label: "半独立", value: "Semi-Detached" },
];
const PT_LABEL: Record<string, string> = Object.fromEntries(PROPERTY_TYPES.map((p) => [p.value, p.label]));

// 预算预设按买/租切换（数量级完全不同）
const PRICE_SALE = [500000, 800000, 1000000, 1500000, 2000000, 3000000];
const PRICE_LEASE = [2000, 2500, 3000, 3500, 4500, 6000];

// 暖色 aurora：几团缓慢漂移的柔光，白底上的氛围，不是冷蓝
function AuroraWarm() {
  const blobs = [
    { c: "255,183,148", o: 0.55, top: "-18%", left: "-8%", x: ["-8%", "10%", "-8%"], y: ["-4%", "8%", "-4%"], s: [1, 1.15, 1], d: 19 },
    { c: "255,196,214", o: 0.5, top: "-12%", right: "-14%", x: ["8%", "-8%", "8%"], y: ["4%", "-6%", "4%"], s: [1.1, 1, 1.1], d: 23 },
    { c: "255,224,179", o: 0.42, bottom: "-24%", left: "20%", x: ["-6%", "6%", "-6%"], y: ["8%", "-4%", "8%"], s: [1, 1.2, 1], d: 27 },
  ];
  return (
    <div aria-hidden style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            width: "62vmin",
            height: "62vmin",
            borderRadius: "9999px",
            filter: "blur(80px)",
            top: (b as any).top,
            left: (b as any).left,
            right: (b as any).right,
            bottom: (b as any).bottom,
            background: `radial-gradient(circle at center, rgba(${b.c},${b.o}), rgba(${b.c},0) 70%)`,
          }}
          animate={{ x: b.x, y: b.y, scale: b.s }}
          transition={{ duration: b.d, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function useTypewriter(words: string[], active: boolean) {
  const [text, setText] = useState("");
  const [i, setI] = useState(0);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!active) {
      setText("");
      setDeleting(false);
      return;
    }
    const word = words[i % words.length];
    let t: ReturnType<typeof setTimeout>;
    if (!deleting && text === word) {
      t = setTimeout(() => setDeleting(true), 1600);
    } else if (deleting && text === "") {
      setDeleting(false);
      setI((v) => v + 1);
    } else {
      t = setTimeout(
        () => setText(deleting ? word.slice(0, text.length - 1) : word.slice(0, text.length + 1)),
        deleting ? 40 : 95
      );
    }
    return () => clearTimeout(t!);
  }, [text, deleting, i, active, words]);

  return text;
}

function IntentTease() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => v + 1), 3200);
    return () => clearInterval(t);
  }, []);
  const cur = TEASES[i % TEASES.length];
  return (
    <div className="mx-auto mt-10 border-t border-neutral-200/70 pt-6">
      <p className="text-[13px] text-neutral-400">我们理解你，而不只是匹配关键词</p>
      <div className="mt-3 flex min-h-[34px] items-center justify-center gap-2.5 text-sm">
        <AnimatePresence mode="wait">
          <motion.div
            key={i}
            className="flex items-center gap-2.5"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.35 }}
          >
            <span className="rounded-full border border-neutral-200 bg-white/70 px-3 py-1 text-neutral-500 backdrop-blur">
              「{cur.surface}」
            </span>
            <ArrowRightIcon className="h-4 w-4 text-neutral-300" />
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">{cur.intent}</span>
            <ArrowRightIcon className="hidden h-4 w-4 text-neutral-300 sm:block" />
            <span className="hidden text-neutral-500 sm:inline">{cur.attrs.join(" · ")}</span>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

// ── 轻量筛选 pill（点开一个下拉面板；点外部关闭） ─────────────────────────
function useClickOutside(ref: React.RefObject<HTMLElement>, onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [ref, onClose, active]);
}

function Pill({
  label,
  active,
  panelKey,
  openKey,
  setOpenKey,
  children,
}: {
  label: string;
  active: boolean;
  panelKey: string;
  openKey: string | null;
  setOpenKey: (k: string | null) => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const open = openKey === panelKey;
  useClickOutside(ref, () => setOpenKey(null), open);
  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpenKey(open ? null : panelKey)}
        className={cn(
          "flex items-center gap-1 rounded-full border px-3.5 py-1.5 text-sm backdrop-blur transition",
          active
            ? "border-neutral-900 bg-neutral-900 text-white"
            : "border-neutral-200 bg-white/70 text-neutral-600 hover:border-neutral-400 hover:text-neutral-900"
        )}
      >
        {label}
        <ChevronDownIcon className={cn("h-3.5 w-3.5 opacity-60 transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-1/2 top-full z-30 mt-2 w-40 -translate-x-1/2 rounded-2xl border border-neutral-200 bg-white p-1.5 text-left shadow-xl">
          {children}
        </div>
      )}
    </div>
  );
}

function Option({ label, selected, onPick }: { label: string; selected: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center justify-between gap-4 rounded-lg px-3 py-1.5 text-sm transition hover:bg-neutral-50"
    >
      <span className={selected ? "font-medium text-neutral-900" : "text-neutral-600"}>{label}</span>
      {selected && <CheckIcon className="h-4 w-4 text-neutral-900" />}
    </button>
  );
}

export function HomeHero({
  type,
  setType,
  onSubmit,
}: {
  type: "sale" | "lease";
  setType: (t: "sale" | "lease") => void;
  onSubmit: (text: string, filters: WebFilters) => void;
}) {
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [iconOk, setIconOk] = useState(true);
  const typed = useTypewriter(PLACEHOLDERS, !value && !focused);

  // 结构化硬约束
  const [place, setPlace] = useState<SelectedPlace | null>(null);
  const [minBeds, setMinBeds] = useState<number | undefined>();
  const [minBaths, setMinBaths] = useState<number | undefined>();
  const [maxPrice, setMaxPrice] = useState<number | undefined>();
  const [propertyType, setPropertyType] = useState<string | undefined>();
  const [openKey, setOpenKey] = useState<string | null>(null);

  const priceLabel = (p: number) => (type === "lease" ? `$${p.toLocaleString()}/月` : `${p / 10000}万`);

  // 买/租切换：预算量级不同，清掉已选预算
  const changeType = (v: "sale" | "lease") => {
    setType(v);
    setMaxPrice(undefined);
  };

  const buildFilters = (): WebFilters => {
    const f: WebFilters = {};
    if (place?.city) f.city = place.city;
    if (place?.near) f.near = place.near;
    if (minBeds) f.minBeds = minBeds;
    if (minBaths) f.minBaths = minBaths;
    if (maxPrice) f.maxPrice = maxPrice;
    if (propertyType) f.propertyType = propertyType;
    return f;
  };

  // 当意图框为空、只设了筛选时，用筛选拼一句可读的话当作聊天气泡
  const summarizeFilters = (f: WebFilters) => {
    const parts = [type === "lease" ? "租" : "买"];
    if (place?.near) parts.push(`离${place.near.label}近`);
    else if (f.city) parts.push(f.city);
    if (f.propertyType) parts.push(PT_LABEL[f.propertyType] ?? f.propertyType);
    if (f.minBeds) parts.push(`${f.minBeds}室起`);
    if (f.minBaths) parts.push(`${f.minBaths}卫起`);
    if (f.maxPrice) parts.push(`${priceLabel(f.maxPrice)}以内`);
    return parts.join(" · ");
  };

  const submit = (v?: string) => {
    const q = (v ?? value).trim();
    const f = buildFilters();
    const hasFilter = Object.keys(f).length > 0;
    if (!q && !hasFilter) return;
    onSubmit(q || summarizeFilters(f), f);
  };

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
      <AuroraWarm />

      <header className="absolute left-6 top-5 z-20 flex items-center gap-2">
        {iconOk && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/deephome-logo.png" alt="" className="h-8 w-auto" onError={() => setIconOk(false)} />
        )}
        <span className="text-lg font-medium tracking-tight text-neutral-800">deephome</span>
      </header>

      <motion.div
        className="relative z-10 w-full max-w-2xl text-center"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">说出你想要什么样的家</h1>
        <p className="mx-auto mt-4 max-w-md text-neutral-500">不用堆关键词。说人话，我们懂你的真实意图。</p>

        <div className="relative mx-auto mt-8 flex max-w-xl items-center gap-2 rounded-full border border-neutral-200 bg-white/80 py-2 pl-5 pr-2 shadow-sm backdrop-blur transition focus-within:border-neutral-400">
          <div className="relative flex-1 text-left">
            <input
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              aria-label="搜索你想要的家"
              className="w-full bg-transparent text-[15px] text-neutral-900 outline-none"
            />
            {!value && (
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[15px] text-neutral-400">
                {typed}
                <span className="ml-0.5 animate-pulse">▌</span>
              </span>
            )}
          </div>
          <button
            onClick={() => submit()}
            aria-label="搜索"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-neutral-900 text-white transition hover:bg-neutral-700"
          >
            <ArrowUpIcon className="h-[18px] w-[18px]" />
          </button>
        </div>

        {/* 高权重硬约束：结构化 filter bar，配角 */}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <div className="inline-flex rounded-full border border-neutral-200 bg-white/70 p-0.5 backdrop-blur">
            {(["sale", "lease"] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeType(v)}
                className={cn(
                  "rounded-full px-4 py-1 text-sm transition",
                  type === v ? "bg-neutral-900 text-white" : "text-neutral-600 hover:text-neutral-900"
                )}
              >
                {v === "sale" ? "买" : "租"}
              </button>
            ))}
          </div>

          <LocationPill place={place} onChange={setPlace} openKey={openKey} setOpenKey={setOpenKey} />

          <Pill label={minBeds ? `${minBeds}+ 室` : "卧室"} active={!!minBeds} panelKey="beds" openKey={openKey} setOpenKey={setOpenKey}>
            <Option label="不限" selected={!minBeds} onPick={() => { setMinBeds(undefined); setOpenKey(null); }} />
            {[1, 2, 3, 4].map((n) => (
              <Option key={n} label={`${n}+ 室`} selected={minBeds === n} onPick={() => { setMinBeds(n); setOpenKey(null); }} />
            ))}
          </Pill>

          <Pill label={minBaths ? `${minBaths}+ 卫` : "卫浴"} active={!!minBaths} panelKey="baths" openKey={openKey} setOpenKey={setOpenKey}>
            <Option label="不限" selected={!minBaths} onPick={() => { setMinBaths(undefined); setOpenKey(null); }} />
            {[1, 2, 3].map((n) => (
              <Option key={n} label={`${n}+ 卫`} selected={minBaths === n} onPick={() => { setMinBaths(n); setOpenKey(null); }} />
            ))}
          </Pill>

          <Pill label={maxPrice ? `≤ ${priceLabel(maxPrice)}` : "预算"} active={!!maxPrice} panelKey="price" openKey={openKey} setOpenKey={setOpenKey}>
            <Option label="不限" selected={!maxPrice} onPick={() => { setMaxPrice(undefined); setOpenKey(null); }} />
            {(type === "lease" ? PRICE_LEASE : PRICE_SALE).map((p) => (
              <Option key={p} label={`≤ ${priceLabel(p)}`} selected={maxPrice === p} onPick={() => { setMaxPrice(p); setOpenKey(null); }} />
            ))}
          </Pill>

          <Pill label={propertyType ? PT_LABEL[propertyType] ?? "房型" : "房型"} active={!!propertyType} panelKey="ptype" openKey={openKey} setOpenKey={setOpenKey}>
            <Option label="不限" selected={!propertyType} onPick={() => { setPropertyType(undefined); setOpenKey(null); }} />
            {PROPERTY_TYPES.map((p) => (
              <Option key={p.value} label={p.label} selected={propertyType === p.value} onPick={() => { setPropertyType(p.value); setOpenKey(null); }} />
            ))}
          </Pill>
        </div>

        <IntentTease />

        <div className="mt-7 flex flex-wrap justify-center gap-2">
          {EXAMPLES.map((e) => (
            <button
              key={e}
              onClick={() => submit(e)}
              className="rounded-full border border-neutral-200 bg-white/60 px-3.5 py-1.5 text-sm text-neutral-600 backdrop-blur transition hover:border-neutral-400 hover:text-neutral-900"
            >
              {e}
            </button>
          ))}
        </div>
      </motion.div>
    </main>
  );
}
