import { PrismaClient } from "@prisma/client";
import { FastifyRequest } from "fastify";

export enum AuditAction {
  CREATE = "CREATE",
  UPDATE = "UPDATE",
  DELETE = "DELETE",
  BULK_CREATE = "BULK_CREATE",
  BULK_UPDATE = "BULK_UPDATE",
  BULK_DELETE = "BULK_DELETE",
  EXPORT = "EXPORT",
  IMPORT = "IMPORT",
}

export interface AuditLogData {
  action: AuditAction;
  tableName: string;
  collectionId?: string;
  recordId: string;
  oldData?: any;
  newData?: any;
  changedFields?: string[];
  transactionId?: string;
}

export interface AuditContext {
  userId?: string;
  userEmail?: string;
  apiKeyId?: string;
  apiKeyName?: string;
  ipAddress?: string;
  userAgent?: string;
  requestMethod?: string;
  requestPath?: string;
}

/**
 * Audit Logging Service
 * Tracks all data changes for compliance and debugging
 */
export class AuditLogService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Create an audit log entry
   */
  async log(
    projectId: string,
    data: AuditLogData,
    context: AuditContext
  ): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          projectId,
          userId: context.userId,
          userEmail: context.userEmail,
          apiKeyId: context.apiKeyId,
          apiKeyName: context.apiKeyName,
          action: data.action,
          tableName: data.tableName,
          collectionId: data.collectionId,
          recordId: data.recordId,
          oldData: data.oldData || null,
          newData: data.newData || null,
          changedFields: data.changedFields || null,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent,
          requestMethod: context.requestMethod,
          requestPath: context.requestPath,
          transactionId: data.transactionId,
        },
      });
    } catch (error) {
      // Log error but don't throw - audit logging should not break operations
      console.error("[AuditLog] Failed to create audit log:", error);
    }
  }

  /**
   * Extract audit context from Fastify request
   */
  extractContext(request: FastifyRequest): AuditContext {
    const user = (request as any).user;
    const apiKey = (request as any).apiKey;
    const project = (request as any).project;

    return {
      userId: user?.id,
      userEmail: user?.email,
      apiKeyId: apiKey?.id,
      apiKeyName: apiKey?.name,
      ipAddress: request.ip,
      userAgent: request.headers["user-agent"],
      requestMethod: request.method,
      requestPath: request.url,
    };
  }

  /**
   * Get changed fields between old and new data
   */
  getChangedFields(oldData: any, newData: any): string[] {
    const changed: string[] = [];

    // Check all keys in newData
    for (const key of Object.keys(newData)) {
      if (JSON.stringify(oldData[key]) !== JSON.stringify(newData[key])) {
        changed.push(key);
      }
    }

    // Check for removed keys
    for (const key of Object.keys(oldData)) {
      if (!(key in newData)) {
        changed.push(key);
      }
    }

    return changed;
  }

  /**
   * Query audit logs with filters
   */
  async query(params: {
    projectId: string;
    page?: number;
    limit?: number;
    userId?: string;
    tableName?: string;
    recordId?: string;
    action?: AuditAction;
    startDate?: Date;
    endDate?: Date;
    transactionId?: string;
  }) {
    const page = params.page || 1;
    const limit = params.limit || 50;
    const skip = (page - 1) * limit;

    const where: any = {
      projectId: params.projectId,
    };

    if (params.userId) where.userId = params.userId;
    if (params.tableName) where.tableName = params.tableName;
    if (params.recordId) where.recordId = params.recordId;
    if (params.action) where.action = params.action;
    if (params.transactionId) where.transactionId = params.transactionId;

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data: logs,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit trail for a specific record
   */
  async getRecordHistory(
    projectId: string,
    tableName: string,
    recordId: string
  ) {
    return this.prisma.auditLog.findMany({
      where: {
        projectId,
        tableName,
        recordId,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Get all changes in a transaction
   */
  async getTransaction(projectId: string, transactionId: string) {
    return this.prisma.auditLog.findMany({
      where: {
        projectId,
        transactionId,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }
}
