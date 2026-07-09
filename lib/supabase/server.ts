import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./env";

// 服务端客户端（RSC / Route Handler）。Server Component 不能写 cookie，
// 所以 setAll 用 try/catch 兜住 —— 会话刷新由 middleware 负责。
export function createClient() {
  if (!hasSupabase) return null;
  const cookieStore = cookies();

  return createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // 在 Server Component 中调用会抛错，可忽略：middleware 已经刷新过会话
        }
      },
    },
  });
}
