"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 未配置 Supabase 时整个隐藏 —— 应用照常可用（搜索本来就不需要登录）。
export function AuthStatus() {
  const [supabase] = useState(() => createClient());
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!supabase) {
      setReady(true);
      return;
    }
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, [supabase]);

  if (!supabase || !ready) return null;

  if (!email) {
    return (
      <Link
        href="/login"
        className="rounded-full border border-neutral-200 px-3 py-1.5 text-sm text-neutral-600 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        登录
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="max-w-[140px] truncate text-sm text-neutral-500" title={email}>
        {email}
      </span>
      <button
        type="button"
        onClick={async () => {
          await supabase.auth.signOut();
          router.refresh();
        }}
        className="rounded-full border border-neutral-200 px-2.5 py-1 text-xs text-neutral-600 transition hover:border-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-900"
      >
        退出
      </button>
    </div>
  );
}
