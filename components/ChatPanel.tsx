"use client";

import { useEffect, useRef, useState } from "react";

export interface Receipt {
  version: number;
  count: number;
  label: string;
}
export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  receipt?: Receipt; // 结果凭证：指针，不是副本
}

const EXAMPLES = ["采光好的两房", "安静 近地铁 一房", "能养狗 高性价比", "高层 景观好"];

export function ChatPanel({
  variant,
  messages,
  onSend,
  busy,
  type,
  setType,
  activeVersion,
  onSelectVersion,
}: {
  variant: "center" | "rail";
  messages: ChatMessage[];
  onSend: (text: string) => void;
  busy: boolean;
  type: "sale" | "lease";
  setType: (t: "sale" | "lease") => void;
  activeVersion: number | null;
  onSelectVersion: (i: number) => void;
}) {
  const [text, setText] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const rail = variant === "rail";

  useEffect(() => {
    if (rail) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, rail]);

  function submit() {
    if (!text.trim() || busy) return;
    onSend(text.trim());
    setText("");
  }

  const Toggle = ({ v, label }: { v: "sale" | "lease"; label: string }) => (
    <button
      onClick={() => setType(v)}
      className={`rounded-full px-3 py-1 text-sm transition ${
        type === v ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className={rail ? "flex h-full flex-col" : "flex flex-col"}>
      {/* transcript */}
      <div className={rail ? "flex-1 space-y-4 overflow-y-auto px-4 py-5" : "space-y-4"}>
        {rail && <p className="text-xs font-medium uppercase tracking-wide text-neutral-400">对话</p>}

        {messages.map((m, i) => (
          <div key={i} className={m.role === "user" ? "flex justify-end" : ""}>
            <div className={m.role === "user" ? "max-w-[85%] rounded-2xl bg-neutral-900 px-3.5 py-2 text-sm text-white" : "max-w-[95%]"}>
              <p className={m.role === "user" ? "" : "text-sm leading-relaxed text-neutral-700"}>{m.text}</p>

              {/* 结果凭证 chip —— 点击可把那一版结果调回舞台 */}
              {m.receipt && (
                <button
                  onClick={() => onSelectVersion(m.receipt!.version)}
                  className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition ${
                    activeVersion === m.receipt.version
                      ? "border-neutral-900 bg-neutral-900 text-white"
                      : "border-neutral-200 text-neutral-600 hover:border-neutral-400"
                  }`}
                  title="在右侧舞台显示这一版结果"
                >
                  <span>🔎</span>
                  <span>{m.receipt.label}</span>
                  {activeVersion !== m.receipt.version && <span className="text-neutral-400">· 查看</span>}
                </button>
              )}
            </div>
          </div>
        ))}

        {busy && <p className="text-sm text-neutral-400">正在思考…</p>}
        <div ref={endRef} />
      </div>

      {/* 输入区 */}
      <div className={rail ? "border-t border-neutral-100 p-3" : "mt-6"}>
        <div className="mb-2 flex items-center gap-2">
          <div className="flex rounded-full border border-neutral-200 p-0.5">
            <Toggle v="sale" label="买" />
            <Toggle v="lease" label="租" />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <textarea
            rows={rail ? 2 : 3}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder="说说你想要什么样的家：采光好、安静、能养狗…"
            className="flex-1 resize-none rounded-2xl border border-neutral-200 px-4 py-3 text-sm outline-none transition focus:border-neutral-400"
          />
          <button
            onClick={submit}
            disabled={busy || !text.trim()}
            className="rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition enabled:hover:bg-neutral-700 disabled:opacity-30"
          >
            发送
          </button>
        </div>

        {!rail && messages.length === 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                onClick={() => onSend(e)}
                className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-400"
              >
                {e}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
