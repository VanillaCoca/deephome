import { NextResponse } from "next/server";
import { bedrockChat, textOf, bedrockModelInfo } from "../../../src/web/bedrock";

export const dynamic = "force-dynamic";

// 仅供本地开发验证 Bedrock 连通性。
// 生产环境必须 404 —— 否则这就是一个无鉴权、按次烧 credits 的公开端点。
export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse("Not Found", { status: 404 });
  }
  try {
    const r = await bedrockChat({
      messages: [{ role: "user", content: "用一句中文确认你在线，并说明你是通过 AWS Bedrock 运行的 Claude Sonnet。" }],
      maxTokens: 200,
    });
    return NextResponse.json({ ok: true, model: bedrockModelInfo, text: textOf(r), usage: r.usage });
  } catch (e: any) {
    return NextResponse.json({ ok: false, model: bedrockModelInfo, error: String(e?.message ?? e) }, { status: 500 });
  }
}
