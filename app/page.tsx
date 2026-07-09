"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { WebListing, WebSearchResult } from "@/src/web/searchService";
import { ChatPanel, type ChatMessage } from "@/components/ChatPanel";
import { Stage } from "@/components/Stage";
import { MobileChatSheet } from "@/components/MobileChatSheet";
import { AuthStatus } from "@/components/AuthStatus";
import { useFavorites } from "@/lib/useFavorites";

// 三态单舞台：
//   S0 意图收集（单栏居中） → S1 结果（对话收进左栏，舞台主导，原地更新） → S2 详情（同舞台分层）
// 移动端：舞台全屏为主，对话收成底部 sheet。

const SPRING = { type: "spring" as const, stiffness: 260, damping: 30 };

function summarize(d: WebSearchResult) {
  const c = d.results[0]?.reasons[0]?.concept;
  return c ? `${d.count} 套 · ${c}优先` : `${d.count} 套`;
}

export default function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [versions, setVersions] = useState<WebSearchResult[]>([]);
  const [active, setActive] = useState<number | null>(null);
  const [detail, setDetail] = useState<WebListing | null>(null);
  const [busy, setBusy] = useState(false);
  const [type, setType] = useState<"sale" | "lease">("sale");
  const [sheetOpen, setSheetOpen] = useState(false);
  const { favorites, toggle: toggleFav, signedIn } = useFavorites();
  const lastOpened = useRef<string | null>(null);

  const activeResult = active != null ? versions[active] : null;
  const phase = versions.length === 0 ? "intake" : "results";

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setBusy(true);
    const prevCount = activeResult?.count ?? null;
    const history = messages.map((m) => ({ role: m.role, text: m.text }));
    setMessages((m) => [...m, { role: "user", text }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: history, text, type }),
      });
      const data = (await res.json()) as { text?: string; search?: WebSearchResult | null; error?: string };
      if (data.error) throw new Error(data.error);

      // 只有当模型真的搜了，舞台才更新；否则停在 S0 继续追问。
      let receipt: ChatMessage["receipt"];
      if (data.search) {
        const idx = versions.length;
        setVersions([...versions, data.search]);
        setActive(idx);
        setDetail(null);
        if (data.search.count) receipt = { version: idx, count: data.search.count, label: summarize(data.search) };

        const concept = data.search.results[0]?.reasons[0]?.concept;
        const delta =
          prevCount != null && prevCount !== data.search.count
            ? `${prevCount} → ${data.search.count} 套`
            : `${data.search.count} 套`;
        toast("结果已更新", { description: concept ? `按「${concept}」重排 · ${delta}` : delta });
      }
      setMessages((m) => [...m, { role: "assistant", text: data.text || "…", receipt }]);
    } catch (e: any) {
      setMessages((m) => [...m, { role: "assistant", text: `出错了：${e?.message ?? e}` }]);
    } finally {
      setBusy(false);
    }
  }

  function selectVersion(i: number) {
    setActive(i);
    setDetail(null);
    const v = versions[i];
    if (v) toast(i === versions.length - 1 ? "已回到最新结果" : "已切回历史版本", { description: `${v.count} 套` });
  }

  function openDetail(l: WebListing) {
    lastOpened.current = l.mlsNumber;
    setDetail(l);
    setSheetOpen(false); // 移动端：看详情时收起对话 sheet
  }

  function handleToggleFavorite(l: WebListing) {
    const willAdd = !favorites.has(l.mlsNumber);
    toggleFav(l); // 登录 → 落库（RLS 保护）；匿名 → 仅内存
    if (willAdd && !signedIn) {
      toast("已收藏（仅本次会话）", { description: "登录后可永久保存到你的账号" });
    }
  }

  // 从详情返回网格时，把焦点还给原来那张卡片（键盘用户不会"迷路"）
  useEffect(() => {
    if (!detail && lastOpened.current) {
      const el = document.querySelector<HTMLElement>(`[data-open-mls="${lastOpened.current}"]`);
      el?.focus();
      lastOpened.current = null;
    }
  }, [detail]);

  const chatProps = {
    messages,
    onSend: send,
    busy,
    type,
    setType,
    activeVersion: active,
    onSelectVersion: selectVersion,
  };

  return (
    <>
      <div className="flex h-screen overflow-hidden">
        {/* 对话：S0 居中大栏 → S1 左侧窄栏（framer-motion 的 layout 负责形变过渡） */}
        <motion.aside
          layout
          transition={SPRING}
          className={cn(
            "flex flex-col bg-white",
            phase === "intake"
              ? "mx-auto w-full max-w-2xl justify-center px-6 py-16"
              : "hidden w-[380px] shrink-0 border-r border-neutral-100 lg:flex"
          )}
        >
          {/* 账号入口：未配置 Supabase 时 AuthStatus 自动隐藏 */}
          <div
            className={cn(
              "flex items-center",
              phase === "intake" ? "mb-8 justify-end" : "justify-between border-b border-neutral-100 px-4 py-3"
            )}
          >
            {phase === "results" && <span className="text-sm font-medium text-neutral-700">Deephome</span>}
            <AuthStatus />
          </div>

          <AnimatePresence>
            {phase === "intake" && (
              <motion.div key="hero" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <h1 className="text-4xl font-semibold tracking-tight text-neutral-900">Deephome</h1>
                <p className="mt-3 text-neutral-500">说说你想要什么样的家 —— 我们理解你的意图，而不只是关键词。</p>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={phase === "intake" ? "mt-8" : "flex min-h-0 flex-1 flex-col"}>
            <ChatPanel variant={phase === "intake" ? "center" : "rail"} {...chatProps} />
          </div>
        </motion.aside>

        {/* 舞台 */}
        <AnimatePresence>
          {phase === "results" && activeResult && (
            <motion.section
              key="stage"
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="flex-1 overflow-y-auto bg-neutral-50/40"
            >
              <Stage
                result={activeResult}
                detail={detail}
                onOpen={openDetail}
                onBack={() => setDetail(null)}
                isHistorical={active !== versions.length - 1}
                favorites={favorites}
                onToggleFavorite={handleToggleFavorite}
                versionKey={active ?? 0}
              />
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* 移动端：对话收成底部 sheet */}
      {phase === "results" && <MobileChatSheet open={sheetOpen} onOpenChange={setSheetOpen} chatProps={chatProps} />}
    </>
  );
}
