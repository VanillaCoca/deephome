// Supabase 是否已配置。未配置时全站优雅降级：中间件放行、登录入口隐藏、应用照常可用。
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const hasSupabase = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
