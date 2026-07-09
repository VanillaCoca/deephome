"use client";

import { useEffect, type ComponentProps } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircleIcon, XIcon } from "lucide-react";
import { ChatPanel } from "@/components/ChatPanel";

type ChatProps = Omit<ComponentProps<typeof ChatPanel>, "variant">;

// 移动端：舞台占满全屏（结果是主角），对话收成底部 sheet。
// 窄屏没法同时呈现两者，所以这里用模态 sheet 是合理取舍 —— 桌面端仍严格遵守"详情不遮挡对话"。
export function MobileChatSheet({
  open,
  onOpenChange,
  chatProps,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  chatProps: ChatProps;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onOpenChange]);

  return (
    <>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full bg-neutral-900 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900 focus-visible:ring-offset-2 lg:hidden"
      >
        <MessageCircleIcon className="size-4" />
        对话
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30 lg:hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => onOpenChange(false)}
            />
            <motion.div
              key="sheet"
              role="dialog"
              aria-modal="true"
              aria-label="对话"
              className="fixed inset-x-0 bottom-0 z-50 flex h-[82vh] flex-col rounded-t-3xl bg-white shadow-2xl lg:hidden"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 300, damping: 32 }}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-neutral-100 px-4 py-3">
                <span className="text-sm font-medium text-neutral-700">对话</span>
                <button
                  type="button"
                  onClick={() => onOpenChange(false)}
                  aria-label="关闭对话"
                  className="rounded-full p-1 text-neutral-500 transition hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
                >
                  <XIcon className="size-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <ChatPanel variant="rail" {...chatProps} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
