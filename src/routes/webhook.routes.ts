import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { WebhookService } from "../lib/webhook.service";

const webhookService = new WebhookService(prisma);

const createWebhookSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  events: z.array(z.string()),
  headers: z.record(z.string()).optional(),
  secret: z.string().optional(),
  maxRetries: z.number().min(0).max(10).optional(),
});

export async function webhookRoutes(fastify: FastifyInstance) {
  // List webhooks
  fastify.get("/:projectId/webhooks", { onRequest: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any;
    const webhooks = await prisma.webhook.findMany({
      where: { projectId },
      include: { _count: { select: { logs: true } } },
    });
    return { success: true, data: webhooks };
  });

  // Create webhook
  fastify.post("/:projectId/webhooks", { onRequest: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any;
    const body = createWebhookSchema.parse(request.body);

    const webhook = await prisma.webhook.create({
      data: { ...body, projectId, events: body.events as any },
    });
    return { success: true, data: webhook };
  });

  // Test webhook
  fastify.post("/webhooks/:id/test", { onRequest: [authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    const result = await webhookService.test(id);
    return { success: result.success, data: result };
  });

  // Get webhook logs
  fastify.get("/webhooks/:id/logs", { onRequest: [authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    const logs = await prisma.webhookLog.findMany({
      where: { webhookId: id },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { success: true, data: logs };
  });

  // Delete webhook
  fastify.delete("/webhooks/:id", { onRequest: [authenticate] }, async (request, reply) => {
    const { id } = request.params as any;
    await prisma.webhook.delete({ where: { id } });
    return { success: true };
  });
}
