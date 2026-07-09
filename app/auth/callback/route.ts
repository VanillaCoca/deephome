import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// 邮箱确认 / OAuth 回跳：把 code 换成会话。
// 注意：部署在 Vercel 这类反向代理后面时，request.url 的 origin 可能是内部主机名，
// 直接用它会把用户跳到错误的域名。必须优先信任 x-forwarded-host。
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = createClient();
    if (supabase) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalDev = process.env.NODE_ENV === "development";
        if (isLocalDev) return NextResponse.redirect(`${origin}${next}`);
        if (forwardedHost) return NextResponse.redirect(`https://${forwardedHost}${next}`);
        return NextResponse.redirect(`${origin}${next}`);
      }
    }
  }
  return NextResponse.redirect(`${origin}/login?error=1`);
}
