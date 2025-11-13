import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../lib/prisma";
import { AuditLogService, AuditAction } from "../lib/audit-log.service";

const auditService = new AuditLogService(prisma);

/**
 * Middleware to enable audit logging for a route
 * Attach this to routes that need audit tracking
 */
export function createAuditMiddleware(action: AuditAction) {
  return async function auditMiddleware(
    request: FastifyRequest,
    reply: FastifyReply
  ) {
    // Extract context from request
    const context = auditService.extractContext(request);
    const project = (request as any).project;

    if (!project) {
      // Skip audit if no project context (shouldn't happen on dynamic API routes)
      return;
    }

    // Attach audit logging function to request for use in route handlers
    (request as any).audit = {
      log: async (data: {
        tableName: string;
        collectionId?: string;
        recordId: string;
        oldData?: any;
        newData?: any;
        transactionId?: string;
      }) => {
        const changedFields =
          data.oldData && data.newData
            ? auditService.getChangedFields(data.oldData, data.newData)
            : undefined;

        await auditService.log(
          project.id,
          {
            action,
            tableName: data.tableName,
            collectionId: data.collectionId,
            recordId: data.recordId,
            oldData: data.oldData,
            newData: data.newData,
            changedFields,
            transactionId: data.transactionId,
          },
          context
        );
      },
      generateTransactionId: () => auditService.generateTransactionId(),
    };
  };
}

/**
 * Auto-audit middleware that wraps responses
 * Automatically logs CREATE/UPDATE/DELETE based on HTTP method
 */
export async function autoAuditMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const project = (request as any).project;

  if (!project) {
    return; // Skip if no project context
  }

  // Map HTTP methods to audit actions
  const methodActionMap: Record<string, AuditAction> = {
    POST: AuditAction.CREATE,
    PATCH: AuditAction.UPDATE,
    PUT: AuditAction.UPDATE,
    DELETE: AuditAction.DELETE,
  };

  const action = methodActionMap[request.method];

  if (!action) {
    return; // Only audit write operations
  }

  // Attach audit function
  const context = auditService.extractContext(request);

  (request as any).audit = {
    log: async (data: {
      tableName: string;
      collectionId?: string;
      recordId: string;
      oldData?: any;
      newData?: any;
      transactionId?: string;
    }) => {
      const changedFields =
        data.oldData && data.newData
          ? auditService.getChangedFields(data.oldData, data.newData)
          : undefined;

      await auditService.log(
        project.id,
        {
          action,
          tableName: data.tableName,
          collectionId: data.collectionId,
          recordId: data.recordId,
          oldData: data.oldData,
          newData: data.newData,
          changedFields,
          transactionId: data.transactionId,
        },
        context
      );
    },
    generateTransactionId: () => auditService.generateTransactionId(),
  };
}

/**
 * Query audit logs for a project
 */
export async function queryAuditLogs(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { projectId } = request.params as any;
    const query = request.query as any;

    const result = await auditService.query({
      projectId,
      page: query.page ? parseInt(query.page) : undefined,
      limit: query.limit ? parseInt(query.limit) : undefined,
      userId: query.userId,
      tableName: query.tableName,
      recordId: query.recordId,
      action: query.action as AuditAction,
      transactionId: query.transactionId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });

    return reply.send({
      success: true,
      data: result.data,
      meta: result.meta,
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: "Failed to query audit logs",
      details: error.message,
    });
  }
}

/**
 * Get audit trail for a specific record
 */
export async function getRecordAuditTrail(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { projectId, tableName, recordId } = request.params as any;

    const history = await auditService.getRecordHistory(
      projectId,
      tableName,
      recordId
    );

    return reply.send({
      success: true,
      data: history,
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: "Failed to get audit trail",
      details: error.message,
    });
  }
}

/**
 * Get transaction details
 */
export async function getTransaction(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { projectId, transactionId } = request.params as any;

    const transaction = await auditService.getTransaction(
      projectId,
      transactionId
    );

    return reply.send({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    return reply.status(500).send({
      success: false,
      error: "Failed to get transaction",
      details: error.message,
    });
  }
}
