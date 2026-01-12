type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

export type GenerateOptions = {
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export class AIService {
  private apiKey: string | undefined;
  private baseUrl: string;

  constructor() {
    this.apiKey = process.env.DEEPSEEK_API_KEY;
    // Many providers expose OpenAI-compatible /v1/chat/completions
    // Allow overriding base URL via env
    this.baseUrl =
      process.env.DEEPSEEK_API_BASE || "https://api.deepseek.com/v1";
  }

  isConfigured() {
    return !!this.apiKey;
  }

  async chat(messages: ChatMessage[], opts: GenerateOptions = {}) {
    if (!this.apiKey) {
      throw new Error(
        "DEEPSEEK_API_KEY is not set. Please configure your environment."
      );
    }

    const model = opts.model || process.env.DEEPSEEK_MODEL || "deepseek-chat";
    const temperature = opts.temperature ?? 0.2;
    const maxTokens = opts.maxTokens ?? 2000;

    const url = `${this.baseUrl.replace(/\/$/, "")}/chat/completions`;

    const body = {
      model,
      temperature,
      max_tokens: maxTokens,
      messages,
    } as any;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `DeepSeek API error (${res.status}): ${errText || res.statusText}`
      );
    }

    const data = await res.json();
    // OpenAI-compatible shape: choices[0].message.content
    const content: string | undefined = data?.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("No content returned from AI provider");
    }
    return content;
  }

  async generateFunctionCode(params: {
    prompt: string;
    language?: "typescript" | "javascript";
    entrypoint?: string;
    includeScaffold?: boolean;
    currentCode?: string;
  }) {
    const {
      prompt,
      language = "typescript",
      entrypoint = "handler",
      includeScaffold = true,
      currentCode,
    } = params;

    const system = `You are an expert BaaS function code generator.\n\nGoal:\n- Generate a ${language} function source compatible with Calmsey BaaS runtime.\n- Export a top-level function named \'${entrypoint}\'.\n- Use the provided runtime context correctly.\n\nRuntime Context available to the function:\n- context.prisma: Prisma client scoped to the project\n- context.request: { body, headers, query, params }\n- context.project: { id, slug }\n- context.env: key-value environment variables\n- context.log(...), context.error(...): logging helpers\n\nConstraints:\n- Return JSON-serializable data.\n- No external imports unless strictly necessary.\n- If using SQL via prisma.$queryRawUnsafe, parameterize and validate inputs.\n\nOutput format:\n- Return ONLY the complete ${language} source code. No explanations.`;

    const user = [
      currentCode ? `Existing code (if refactor):\n\n${currentCode}` : null,
      `Specification / Request:\n\n${prompt}`,
      includeScaffold
        ? `Ensure the output includes:\n- export async function ${entrypoint}(context) { ... }\n- Safe handling of request inputs and errors.`
        : null,
    ]
      .filter(Boolean)
      .join("\n\n---\n\n");

    return this.chat(
      [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      { temperature: 0.2 }
    );
  }
}

export const aiService = new AIService();
