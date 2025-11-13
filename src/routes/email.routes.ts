import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { EmailService } from "../lib/email.service";

const emailService = new EmailService(prisma);

const sendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email())]),
  subject: z.string(),
  text: z.string().optional(),
  html: z.string().optional(),
  template: z.string().optional(),
  templateData: z.record(z.any()).optional(),
});

const updateEmailSettingsSchema = z.object({
  emailEnabled: z.boolean(),
  emailProvider: z.enum(["smtp", "sendgrid", "mailgun", "ses"]),
  emailConfig: z.object({
    provider: z.string(),
    host: z.string().optional(),
    port: z.number().optional(),
    auth: z.object({
      user: z.string(),
      pass: z.string(),
    }).optional(),
    apiKey: z.string().optional(),
    from: z.string().optional(),
  }),
});

export async function emailRoutes(fastify: FastifyInstance) {
  // Send email
  fastify.post("/:projectId/email/send", { onRequest: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any;
    const body = sendEmailSchema.parse(request.body);

    const emailId = await emailService.send(projectId, body);
    return { success: true, data: { emailId } };
  });

  // Get email logs
  fastify.get("/:projectId/email/logs", { onRequest: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any;
    const logs = await prisma.emailLog.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return { success: true, data: logs };
  });

  // Get email stats
  fastify.get("/:projectId/email/stats", { onRequest: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any;
    const stats = await emailService.getStats(projectId);
    return { success: true, data: stats };
  });

  // Update email settings
  fastify.patch("/:projectId/email/settings", { onRequest: [authenticate] }, async (request, reply) => {
    const { projectId } = request.params as any;
    const body = updateEmailSettingsSchema.parse(request.body);

    const settings = await prisma.projectSettings.update({
      where: { projectId },
      data: {
        emailEnabled: body.emailEnabled,
        emailProvider: body.emailProvider,
        emailConfig: body.emailConfig as any,
      },
    });
    return { success: true, data: settings };
  });
}
