import { PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

export interface WebhookPayload {
  event: string;
  collection?: string;
  action?: string;
  data: any;
  timestamp: string;
  projectId: string;
}

/**
 * Webhook Service
 * Manages webhook delivery with retry mechanism
 */
export class WebhookService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Trigger webhooks for an event
   */
  async trigger(
    projectId: string,
    event: string,
    data: any,
    collection?: string
  ): Promise<void> {
    // Get all active webhooks for this project that subscribe to this event
    const webhooks = await this.prisma.webhook.findMany({
      where: {
        projectId,
        active: true,
      },
    });

    const relevantWebhooks = webhooks.filter((webhook) => {
      const events = webhook.events as string[];
      return events.includes(event) || events.includes("*"); // * = all events
    });

    // Deliver to all relevant webhooks
    const promises = relevantWebhooks.map((webhook) =>
      this.deliver(webhook.id, event, data, collection)
    );

    await Promise.all(promises);
  }

  /**
   * Deliver webhook with retry
   */
  async deliver(
    webhookId: string,
    event: string,
    data: any,
    collection?: string,
    attempt: number = 1
  ): Promise<void> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
      include: { project: true },
    });

    if (!webhook || !webhook.active) return;

    const payload: WebhookPayload = {
      event,
      collection,
      action: event.split(":")[1] || event,
      data,
      timestamp: new Date().toISOString(),
      projectId: webhook.projectId,
    };

    const startTime = Date.now();
    let status: "SUCCESS" | "FAILED" | "RETRYING" = "FAILED";
    let statusCode: number | null = null;
    let response: string | null = null;
    let error: string | null = null;

    try {
      // Prepare headers
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Calmsey-BaaS-Webhook/1.0",
        "X-Webhook-Event": event,
        "X-Webhook-Delivery": crypto.randomUUID(),
        ...(webhook.headers as Record<string, string> || {}),
      };

      // Add signature if secret is configured
      if (webhook.secret) {
        const signature = this.generateSignature(payload, webhook.secret);
        headers["X-Webhook-Signature"] = signature;
      }

      // Send webhook
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), webhook.timeout);

      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      statusCode = res.status;
      response = await res.text();

      if (res.ok) {
        status = "SUCCESS";

        // Update success stats
        await this.prisma.webhook.update({
          where: { id: webhookId },
          data: {
            lastTriggered: new Date(),
            successCount: { increment: 1 },
          },
        });
      } else {
        error = `HTTP ${statusCode}: ${response}`;

        // Retry if not max attempts
        if (attempt < webhook.maxRetries) {
          status = "RETRYING";
          // Exponential backoff: 2^attempt seconds
          const delay = Math.pow(2, attempt) * 1000;
          setTimeout(() => {
            this.deliver(webhookId, event, data, collection, attempt + 1);
          }, delay);
        } else {
          await this.prisma.webhook.update({
            where: { id: webhookId },
            data: {
              failureCount: { increment: 1 },
            },
          });
        }
      }
    } catch (err: any) {
      error = err.message;

      // Retry on network errors
      if (attempt < webhook.maxRetries) {
        status = "RETRYING";
        const delay = Math.pow(2, attempt) * 1000;
        setTimeout(() => {
          this.deliver(webhookId, event, data, collection, attempt + 1);
        }, delay);
      } else {
        await this.prisma.webhook.update({
          where: { id: webhookId },
          data: {
            failureCount: { increment: 1 },
          },
        });
      }
    }

    // Log delivery
    await this.prisma.webhookLog.create({
      data: {
        webhookId,
        event,
        payload: payload as any,
        status: status as any,
        statusCode,
        response,
        error,
        attempt,
        duration: Date.now() - startTime,
      },
    });
  }

  /**
   * Generate HMAC signature for webhook payload
   */
  private generateSignature(payload: any, secret: string): string {
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(JSON.stringify(payload));
    return `sha256=${hmac.digest("hex")}`;
  }

  /**
   * Verify webhook signature
   */
  verifySignature(payload: any, signature: string, secret: string): boolean {
    const expectedSignature = this.generateSignature(payload, secret);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Test webhook
   */
  async test(webhookId: string): Promise<{
    success: boolean;
    statusCode?: number;
    response?: string;
    error?: string;
    duration: number;
  }> {
    const webhook = await this.prisma.webhook.findUnique({
      where: { id: webhookId },
    });

    if (!webhook) {
      return {
        success: false,
        error: "Webhook not found",
        duration: 0,
      };
    }

    const testPayload: WebhookPayload = {
      event: "test",
      data: { message: "This is a test webhook from Calmsey BaaS" },
      timestamp: new Date().toISOString(),
      projectId: webhook.projectId,
    };

    const startTime = Date.now();

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "User-Agent": "Calmsey-BaaS-Webhook/1.0",
        "X-Webhook-Event": "test",
        ...(webhook.headers as Record<string, string> || {}),
      };

      if (webhook.secret) {
        headers["X-Webhook-Signature"] = this.generateSignature(
          testPayload,
          webhook.secret
        );
      }

      const res = await fetch(webhook.url, {
        method: "POST",
        headers,
        body: JSON.stringify(testPayload),
      });

      const response = await res.text();

      return {
        success: res.ok,
        statusCode: res.status,
        response,
        duration: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Retry failed webhook
   */
  async retry(webhookLogId: string): Promise<void> {
    const log = await this.prisma.webhookLog.findUnique({
      where: { id: webhookLogId },
      include: { webhook: true },
    });

    if (!log || !log.webhook) return;

    const payload = log.payload as WebhookPayload;
    await this.deliver(
      log.webhookId,
      log.event,
      payload.data,
      payload.collection,
      1
    );
  }
}
