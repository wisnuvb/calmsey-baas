import { PrismaClient } from "@prisma/client";
import nodemailer, { Transporter } from "nodemailer";
import { Queue, Worker } from "bullmq";
import { Redis } from "ioredis";

export interface EmailConfig {
  provider: "smtp" | "sendgrid" | "mailgun" | "ses";
  host?: string;
  port?: number;
  secure?: boolean;
  auth?: {
    user: string;
    pass: string;
  };
  apiKey?: string;
  from?: string;
}

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  template?: string;
  templateData?: Record<string, any>;
  type?: "TRANSACTIONAL" | "NOTIFICATION" | "MARKETING" | "SYSTEM";
  metadata?: Record<string, any>;
}

/**
 * Email Service
 * Handles email sending with queue support
 */
export class EmailService {
  private prisma: PrismaClient;
  private transporters: Map<string, Transporter> = new Map();
  private emailQueue?: Queue;
  private redis?: Redis;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;

    // Initialize Redis & Queue if Redis is configured
    if (process.env.REDIS_URL) {
      try {
        this.redis = new Redis(process.env.REDIS_URL);
        this.emailQueue = new Queue("emails", {
          connection: this.redis,
        });

        // Start worker
        this.startWorker();
      } catch (error) {
        console.warn("[Email] Redis not available, using direct sending");
      }
    }
  }

  /**
   * Get or create transporter for a project
   */
  private async getTransporter(projectId: string): Promise<Transporter | null> {
    // Check cache
    if (this.transporters.has(projectId)) {
      return this.transporters.get(projectId)!;
    }

    // Get project settings
    const settings = await this.prisma.projectSettings.findUnique({
      where: { projectId },
    });

    if (!settings || !settings.emailEnabled || !settings.emailConfig) {
      return null;
    }

    const config = settings.emailConfig as EmailConfig;

    let transporter: Transporter;

    switch (config.provider) {
      case "smtp":
        transporter = nodemailer.createTransport({
          host: config.host,
          port: config.port || 587,
          secure: config.secure || false,
          auth: config.auth,
        });
        break;

      case "sendgrid":
        transporter = nodemailer.createTransport({
          host: "smtp.sendgrid.net",
          port: 587,
          auth: {
            user: "apikey",
            pass: config.apiKey!,
          },
        });
        break;

      case "mailgun":
        transporter = nodemailer.createTransport({
          host: "smtp.mailgun.org",
          port: 587,
          auth: {
            user: config.auth?.user!,
            pass: config.apiKey!,
          },
        });
        break;

      default:
        throw new Error(`Unsupported email provider: ${config.provider}`);
    }

    // Cache transporter
    this.transporters.set(projectId, transporter);

    return transporter;
  }

  /**
   * Send email (queued if Redis available, direct otherwise)
   */
  async send(projectId: string, options: SendEmailOptions): Promise<string> {
    // Create email log
    const emailLog = await this.prisma.emailLog.create({
      data: {
        projectId,
        to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
        from: options.from || "",
        subject: options.subject,
        body: options.text || "",
        html: options.html,
        type: (options.type || "TRANSACTIONAL") as any,
        status: "PENDING" as any,
        template: options.template,
        templateData: options.templateData as any,
        metadata: options.metadata as any,
      },
    });

    if (this.emailQueue) {
      // Add to queue
      await this.emailQueue.add("send-email", {
        emailLogId: emailLog.id,
        projectId,
        options,
      });
    } else {
      // Send directly
      await this.sendDirect(emailLog.id, projectId, options);
    }

    return emailLog.id;
  }

  /**
   * Send email directly
   */
  private async sendDirect(
    emailLogId: string,
    projectId: string,
    options: SendEmailOptions
  ): Promise<void> {
    try {
      // Update status to sending
      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: { status: "SENDING" as any },
      });

      const transporter = await this.getTransporter(projectId);

      if (!transporter) {
        throw new Error("Email not configured for this project");
      }

      // Apply template if specified
      let html = options.html;
      let text = options.text;

      if (options.template && options.templateData) {
        const rendered = this.renderTemplate(
          options.template,
          options.templateData
        );
        html = rendered.html;
        text = rendered.text;
      }

      // Send email
      const info = await transporter.sendMail({
        from: options.from || undefined,
        to: options.to,
        subject: options.subject,
        text,
        html,
      });

      // Update log as sent
      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: "SENT" as any,
          messageId: info.messageId,
          sentAt: new Date(),
        },
      });
    } catch (error: any) {
      // Update log as failed
      await this.prisma.emailLog.update({
        where: { id: emailLogId },
        data: {
          status: "FAILED" as any,
          error: error.message,
        },
      });

      throw error;
    }
  }

  /**
   * Start BullMQ worker
   */
  private startWorker(): void {
    if (!this.redis) return;

    const worker = new Worker(
      "emails",
      async (job) => {
        const { emailLogId, projectId, options } = job.data;
        await this.sendDirect(emailLogId, projectId, options);
      },
      {
        connection: this.redis,
        concurrency: parseInt(process.env.EMAIL_CONCURRENCY || "5"),
      }
    );

    worker.on("failed", (job, err) => {
      console.error(`[Email] Job ${job?.id} failed:`, err);
    });

    worker.on("completed", (job) => {
      console.log(`[Email] Job ${job.id} completed`);
    });
  }

  /**
   * Simple template rendering
   */
  private renderTemplate(
    template: string,
    data: Record<string, any>
  ): { html: string; text: string } {
    let html = template;
    let text = template.replace(/<[^>]*>/g, ""); // Strip HTML tags

    // Replace {{variable}} with data
    Object.keys(data).forEach((key) => {
      const regex = new RegExp(`{{${key}}}`, "g");
      html = html.replace(regex, data[key]);
      text = text.replace(regex, data[key]);
    });

    return { html, text };
  }

  /**
   * Get email statistics
   */
  async getStats(projectId: string, days: number = 30): Promise<any> {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const [total, sent, failed, pending] = await Promise.all([
      this.prisma.emailLog.count({
        where: { projectId, createdAt: { gte: since } },
      }),
      this.prisma.emailLog.count({
        where: { projectId, status: "SENT", createdAt: { gte: since } },
      }),
      this.prisma.emailLog.count({
        where: { projectId, status: "FAILED", createdAt: { gte: since } },
      }),
      this.prisma.emailLog.count({
        where: {
          projectId,
          status: { in: ["PENDING", "SENDING"] },
          createdAt: { gte: since },
        },
      }),
    ]);

    return {
      total,
      sent,
      failed,
      pending,
      successRate: total > 0 ? ((sent / total) * 100).toFixed(2) : 0,
    };
  }

  /**
   * Close connections
   */
  async close(): Promise<void> {
    // Close all transporters
    this.transporters.clear();

    // Close Redis
    if (this.redis) {
      await this.redis.quit();
    }

    // Close queue
    if (this.emailQueue) {
      await this.emailQueue.close();
    }
  }
}
