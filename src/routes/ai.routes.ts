import { FastifyInstance } from "fastify";
import { authenticate } from "../middleware/auth.middleware";
import { aiService } from "../lib/ai.service";

export async function aiRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/generate-function",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["ai"],
        summary: "Generate function code with AI",
        description:
          "Generate a serverless function source code using the configured AI provider (DeepSeek)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt: { type: "string" },
            language: {
              type: "string",
              enum: ["typescript", "javascript"],
              default: "typescript",
            },
            entrypoint: { type: "string", default: "handler" },
            includeScaffold: { type: "boolean", default: true },
            currentCode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        if (!aiService.isConfigured()) {
          return reply.status(500).send({
            success: false,
            error:
              "AI provider is not configured. Set DEEPSEEK_API_KEY (and optional DEEPSEEK_API_BASE).",
          });
        }

        const body = request.body as {
          prompt: string;
          language?: "typescript" | "javascript";
          entrypoint?: string;
          includeScaffold?: boolean;
          currentCode?: string;
        };

        const code = await aiService.generateFunctionCode({
          prompt: body.prompt,
          language: body.language,
          entrypoint: body.entrypoint,
          includeScaffold: body.includeScaffold,
          currentCode: body.currentCode,
        });

        return reply.send({ success: true, code });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to generate code",
        });
      }
    }
  );
}
