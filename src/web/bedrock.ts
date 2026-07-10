// 服务端专用：通过原生 HTTP 调 AWS Bedrock 上的 Sonnet。
// - Anthropic Messages 格式 + "anthropic_version": "bedrock-2023-05-31"
// - 鉴权：Authorization: Bearer <AWS_BEARER_TOKEN_BEDROCK>
// - 不引入任何 SDK，只用 fetch。key 只在服务端读，绝不下发浏览器。

const REGION = process.env.AWS_REGION || "us-east-2";
const MODEL_ID = process.env.BEDROCK_MODEL_ID || "us.anthropic.claude-sonnet-4-6";
const ENDPOINT = `https://bedrock-runtime.${REGION}.amazonaws.com`;

export type Role = "user" | "assistant";
export interface BedrockMessage {
  role: Role;
  content: any; // string 或 Anthropic content blocks（含 tool_use / tool_result）
}

export interface BedrockChatInput {
  messages: BedrockMessage[];
  system?: string;
  maxTokens?: number;
  temperature?: number;
  tools?: any[]; // Anthropic tools 定义（用于工具调用）
  toolChoice?: any;
}

// 返回 Anthropic 原始响应：{ id, content:[...], stop_reason, usage, ... }
export async function bedrockChat(input: BedrockChatInput): Promise<any> {
  const key = bedrockKey();
  if (!key) throw new Error("缺少 Bedrock API key（在 .env 设 AWS_BEARER_TOKEN_BEDROCK 或 AWS_BEDROCK_API_KEY）");

  const body: any = {
    anthropic_version: "bedrock-2023-05-31",
    max_tokens: input.maxTokens ?? 1024,
    messages: input.messages,
  };
  if (input.system) body.system = input.system;
  if (input.temperature != null) body.temperature = input.temperature;
  if (input.tools) body.tools = input.tools;
  if (input.toolChoice) body.tool_choice = input.toolChoice;

  const res = await fetch(`${ENDPOINT}/model/${MODEL_ID}/invoke`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`Bedrock ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

// 从响应里取纯文本
export function textOf(resp: any): string {
  return (resp?.content ?? [])
    .filter((b: any) => b?.type === "text")
    .map((b: any) => b.text)
    .join("");
}

// 从响应里取工具调用块（tool_use）
export function toolUsesOf(resp: any): { id: string; name: string; input: any }[] {
  return (resp?.content ?? []).filter((b: any) => b?.type === "tool_use");
}

// 把 Bedrock 封成意图引擎的 LLMAdapter（complete(prompt) -> text）
export function bedrockLLMAdapter() {
  return {
    async complete(prompt: string): Promise<string> {
      const r = await bedrockChat({ messages: [{ role: "user", content: prompt }], maxTokens: 800 });
      return textOf(r);
    },
  };
}

// 兼容两种命名：AWS_BEARER_TOKEN_BEDROCK（AI SDK 约定）或 AWS_BEDROCK_API_KEY
export function bedrockKey(): string | undefined {
  return process.env.AWS_BEARER_TOKEN_BEDROCK || process.env.AWS_BEDROCK_API_KEY;
}
export function hasBedrockKey(): boolean {
  return Boolean(bedrockKey());
}

export const bedrockModelInfo = { region: REGION, modelId: MODEL_ID, endpoint: ENDPOINT };
