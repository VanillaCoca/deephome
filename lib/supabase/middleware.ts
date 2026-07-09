import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./env";

// 刷新过期的 auth token，并把新 cookie 同时写回 request（给 RSC）和 response（给浏览器）。
// 注意：这里【不做】强制跳转 —— 搜索是公开的，登录只解锁收藏/历史。
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!hasSupabase) return supabaseResponse; // 未配置 Supabase → 直接放行

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options));
      },
    },
  });

  // 必须调用：它会在需要时刷新会话
  await supabase.auth.getUser();

  return supabaseResponse;
}
