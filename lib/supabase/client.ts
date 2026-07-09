import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_ANON_KEY, SUPABASE_URL, hasSupabase } from "./env";

// 浏览器端客户端。@supabase/ssr 的 browser client 会把会话写进 cookie，
// 这样服务端（RSC / route handler / middleware）也能读到同一个会话。
export function createClient() {
  if (!hasSupabase) return null;
  return createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
}
