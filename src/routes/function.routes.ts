import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { generateSlug } from "../lib/utils";
import { FunctionRuntimeService } from "../lib/function-runtime.service";

const runtimeService = new FunctionRuntimeService();

export async function functionRoutes(fastify: FastifyInstance) {
  /**
   * List functions for a project
   * GET /api/functions?projectId=xxx
   */
  fastify.get(
    "/",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "List functions",
        description: "Get all functions for a project",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: { type: "string" },
            status: {
              type: "string",
              enum: ["DRAFT", "ACTIVE", "INACTIVE", "ERROR"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectId, status } = request.query as {
          projectId: string;
          status?: string;
        };
        const user = (request as any).user;

        // Verify user owns the project
        const project = await prisma.project.findFirst({
          where: {
            id: projectId,
            userId: user.id,
          },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        // Get functions
        const functions = await prisma.function.findMany({
          where: {
            projectId,
            ...(status && { status: status as any }),
          },
          orderBy: {
            createdAt: "desc",
          },
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            language: true,
            status: true,
            version: true,
            invocations: true,
            lastInvoked: true,
            avgDuration: true,
            errorRate: true,
            timeout: true,
            memory: true,
            createdAt: true,
            updatedAt: true,
          },
        });

        return reply.send({
          success: true,
          data: functions,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch functions",
        });
      }
    }
  );

  /**
   * Get single function
   * GET /api/functions/:id
   */
  fastify.get(
    "/:id",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "Get function",
        description: "Get function by ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;

        const func = await prisma.function.findFirst({
          where: {
            id,
            project: {
              userId: user.id,
            },
          },
          include: {
            project: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        });

        if (!func) {
          return reply.status(404).send({
            success: false,
            error: "Function not found",
          });
        }

        return reply.send({
          success: true,
          data: func,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch function",
        });
      }
    }
  );

  /**
   * Create new function
   * POST /api/functions
   */
  fastify.post(
    "/",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "Create function",
        description: "Create a new serverless function",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["name", "projectId", "sourceCode"],
          properties: {
            name: { type: "string" },
            projectId: { type: "string" },
            description: { type: "string" },
            sourceCode: { type: "string" },
            language: { type: "string", default: "typescript" },
            entrypoint: { type: "string", default: "handler" },
            timeout: { type: "number", default: 30000 },
            memory: { type: "number", default: 256 },
            envVars: { type: "object" },
            status: {
              type: "string",
              enum: ["DRAFT", "ACTIVE"],
              default: "DRAFT",
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = (request as any).user;
        const data = request.body as any;

        // Verify user owns the project
        const project = await prisma.project.findFirst({
          where: {
            id: data.projectId,
            userId: user.id,
          },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        // Validate source code
        const validation = await runtimeService.validate(data.sourceCode);
        if (!validation.valid) {
          return reply.status(400).send({
            success: false,
            error: "Invalid source code",
            details: validation.error,
          });
        }

        // Generate slug
        const slug = generateSlug(data.name);

        // Check if slug already exists
        const existing = await prisma.function.findUnique({
          where: {
            projectId_slug: {
              projectId: data.projectId,
              slug,
            },
          },
        });

        if (existing) {
          return reply.status(400).send({
            success: false,
            error: "Function with this name already exists",
          });
        }

        // Create function
        const func = await prisma.function.create({
          data: {
            name: data.name,
            slug,
            description: data.description,
            sourceCode: data.sourceCode,
            language: data.language || "typescript",
            entrypoint: data.entrypoint || "handler",
            timeout: data.timeout || 30000,
            memory: data.memory || 256,
            envVars: data.envVars || {},
            status: data.status || "DRAFT",
            projectId: data.projectId,
          },
        });

        return reply.status(201).send({
          success: true,
          data: func,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to create function",
          details: err.message,
        });
      }
    }
  );

  /**
   * Update function
   * PATCH /api/functions/:id
   */
  fastify.patch(
    "/:id",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "Update function",
        description: "Update an existing function",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            sourceCode: { type: "string" },
            entrypoint: { type: "string" },
            timeout: { type: "number" },
            memory: { type: "number" },
            envVars: { type: "object" },
            status: {
              type: "string",
              enum: ["DRAFT", "ACTIVE", "INACTIVE", "ERROR"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;
        const data = request.body as any;

        // Verify user owns the function
        const existing = await prisma.function.findFirst({
          where: {
            id,
            project: {
              userId: user.id,
            },
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: "Function not found",
          });
        }

        // If source code changed, validate it
        if (data.sourceCode && data.sourceCode !== existing.sourceCode) {
          const validation = await runtimeService.validate(data.sourceCode);
          if (!validation.valid) {
            return reply.status(400).send({
              success: false,
              error: "Invalid source code",
              details: validation.error,
            });
          }

          // Clear cache for old version
          if (existing.bundleHash) {
            runtimeService.clearCache(existing.bundleHash);
          }
        }

        // Update slug if name changed
        let slug = existing.slug;
        if (data.name && data.name !== existing.name) {
          slug = generateSlug(data.name);

          // Check if new slug already exists
          const slugExists = await prisma.function.findFirst({
            where: {
              projectId: existing.projectId,
              slug,
              id: { not: id },
            },
          });

          if (slugExists) {
            return reply.status(400).send({
              success: false,
              error: "Function with this name already exists",
            });
          }
        }

        // Update function
        const func = await prisma.function.update({
          where: { id },
          data: {
            ...(data.name && { name: data.name, slug }),
            ...(data.description !== undefined && {
              description: data.description,
            }),
            ...(data.sourceCode && { sourceCode: data.sourceCode }),
            ...(data.entrypoint && { entrypoint: data.entrypoint }),
            ...(data.timeout && { timeout: data.timeout }),
            ...(data.memory && { memory: data.memory }),
            ...(data.envVars && { envVars: data.envVars }),
            ...(data.status && { status: data.status }),
            version: existing.version + 1,
          },
        });

        return reply.send({
          success: true,
          data: func,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to update function",
          details: err.message,
        });
      }
    }
  );

  /**
   * Delete function
   * DELETE /api/functions/:id
   */
  fastify.delete(
    "/:id",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "Delete function",
        description: "Delete a function",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const user = (request as any).user;

        // Verify user owns the function
        const existing = await prisma.function.findFirst({
          where: {
            id,
            project: {
              userId: user.id,
            },
          },
        });

        if (!existing) {
          return reply.status(404).send({
            success: false,
            error: "Function not found",
          });
        }

        // Clear cache
        if (existing.bundleHash) {
          runtimeService.clearCache(existing.bundleHash);
        }

        // Delete function (cascade will delete logs)
        await prisma.function.delete({
          where: { id },
        });

        return reply.send({
          success: true,
          message: "Function deleted successfully",
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to delete function",
        });
      }
    }
  );

  /**
   * Get function logs
   * GET /api/functions/:id/logs
   */
  fastify.get(
    "/:id/logs",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "Get function logs",
        description: "Get execution logs for a function",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", default: 1 },
            limit: { type: "number", default: 50 },
            status: {
              type: "string",
              enum: ["SUCCESS", "ERROR", "TIMEOUT", "MEMORY_EXCEEDED"],
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { page = 1, limit = 50, status } = request.query as any;
        const user = (request as any).user;

        // Verify user owns the function
        const func = await prisma.function.findFirst({
          where: {
            id,
            project: {
              userId: user.id,
            },
          },
        });

        if (!func) {
          return reply.status(404).send({
            success: false,
            error: "Function not found",
          });
        }

        // Get logs
        const [logs, total] = await Promise.all([
          prisma.functionLog.findMany({
            where: {
              functionId: id,
              ...(status && { status: status as any }),
            },
            orderBy: {
              createdAt: "desc",
            },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.functionLog.count({
            where: {
              functionId: id,
              ...(status && { status: status as any }),
            },
          }),
        ]);

        return reply.send({
          success: true,
          data: logs,
          meta: {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
          },
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch logs",
        });
      }
    }
  );

  /**
   * Validate function code
   * POST /api/functions/validate
   */
  fastify.post(
    "/validate",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["functions"],
        summary: "Validate function code",
        description:
          "Validate TypeScript/JavaScript code without creating function",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["sourceCode"],
          properties: {
            sourceCode: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { sourceCode } = request.body as { sourceCode: string };

        const validation = await runtimeService.validate(sourceCode);

        return reply.send({
          success: validation.valid,
          valid: validation.valid,
          error: validation.error,
        });
      } catch (err: any) {
        return reply.status(400).send({
          success: false,
          valid: false,
          error: err.message,
        });
      }
    }
  );
}
