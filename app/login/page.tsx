"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Mode = "signin" | "signup";

export default function LoginPage() {
  const [supabase] = useState(() => createClient());
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const router = useRouter();

  if (!supabase) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <h1 className="text-2xl font-semibold">尚未配置 Supabase</h1>
        <p className="mt-2 text-sm text-neutral-500">
          在 <code className="rounded bg-neutral-100 px-1">.env</code> 里填入 NEXT_PUBLIC_SUPABASE_URL 与
          NEXT_PUBLIC_SUPABASE_ANON_KEY 后重启即可。搜索功能不受影响。
        </p>
        <Link href="/" className="mt-6 text-sm text-neutral-600 underline">
          ← 返回搜索
        </Link>
      </main>
    );
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      if (mode === "signin") {
        const { error } = await supabase!.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.push("/");
        router.refresh();
      } else {
        const { error } = await supabase!.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (error) throw error;
        setSent(true);
      }
    } catch (err: any) {
      setError(err?.message ?? "出错了，请重试");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <Link href="/" className="mb-8 text-sm text-neutral-400 transition hover:text-neutral-700">
        ← 返回搜索
      </Link>

      <h1 className="text-3xl font-semibold tracking-tight text-neutral-900">
        {mode === "signin" ? "登录 Deephome" : "创建账号"}
      </h1>
      <p className="mt-2 text-sm text-neutral-500">登录后可以保存收藏与对话历史。搜索本身无需登录。</p>

      {sent ? (
        <div className="mt-8 rounded-2xl border border-neutral-200 p-5">
          <p className="text-sm text-neutral-700">确认邮件已发送到 {email}，点击邮件里的链接即可完成注册。</p>
        </div>
      ) : (
        <form onSubmit={submit} className="mt-8 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm text-neutral-600">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-neutral-400"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm text-neutral-600">
              密码
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-xl border border-neutral-200 px-3.5 py-2.5 text-sm outline-none transition focus:border-neutral-400"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-full bg-neutral-900 py-3 text-sm font-medium text-white transition enabled:hover:bg-neutral-700 disabled:opacity-40"
          >
            {busy ? "处理中…" : mode === "signin" ? "登录" : "注册"}
          </button>
        </form>
      )}

      {!sent && (
        <p className="mt-6 text-center text-sm text-neutral-500">
          {mode === "signin" ? "还没有账号？" : "已经有账号？"}
          <button
            type="button"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
            className="ml-1 text-neutral-900 underline underline-offset-4"
          >
            {mode === "signin" ? "注册" : "登录"}
          </button>
        </p>
      )}
    </main>
  );
}
