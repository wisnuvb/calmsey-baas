import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticateApiKey } from "../middleware/auth.middleware";
import { FunctionRuntimeService } from "../lib/function-runtime.service";
import {
  createRateLimitConfig,
  rateLimitByApiKey,
} from "../middleware/rate-limit.middleware";

const runtimeService = new FunctionRuntimeService();

export async function functionInvokeRoutes(fastify: FastifyInstance) {
  /**
   * Invoke function
   * POST /api/invoke/:projectSlug/:functionSlug
   */
  fastify.post(
    "/:projectSlug/:functionSlug",
    {
      onRequest: [authenticateApiKey],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.FUNCTION_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.FUNCTION_RATE_LIMIT_WINDOW || "1 minute",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["functions"],
        summary: "Invoke function",
        description: "Execute a serverless function",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          required: ["projectSlug", "functionSlug"],
          properties: {
            projectSlug: { type: "string" },
            functionSlug: { type: "string" },
          },
        },
        body: {
          type: "object",
          additionalProperties: true,
        },
      },
    },
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { projectSlug, functionSlug } = request.params as {
          projectSlug: string;
          functionSlug: string;
        };

        const project = (request as any).project;
        const apiKey = (request as any).apiKey;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get function
        const func = await prisma.function.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: functionSlug,
            },
          },
        });

        if (!func) {
          return reply.status(404).send({
            success: false,
            error: "Function not found",
          });
        }

        // Check if function is active
        if (func.status !== "ACTIVE") {
          return reply.status(400).send({
            success: false,
            error: `Function is ${func.status.toLowerCase()}`,
          });
        }

        // Execute function
        const result = await runtimeService.execute(
          {
            id: func.id,
            sourceCode: func.sourceCode,
            entrypoint: func.entrypoint,
            timeout: func.timeout,
            memory: func.memory,
            envVars: (func.envVars as Record<string, string>) || {},
            projectId: project.id,
            projectSlug: project.slug,
          },
          prisma,
          {
            body: request.body,
            headers: request.headers as Record<string, string>,
            method: request.method,
            query: request.query as Record<string, string>,
            params: request.params as Record<string, string>,
          }
        );

        // Log execution
        await prisma.functionLog.create({
          data: {
            functionId: func.id,
            status: result.status,
            duration: result.duration,
            requestBody: request.body || {},
            requestHeaders: request.headers,
            requestMethod: request.method,
            requestQuery: request.query || {},
            responseBody: result.data || null,
            responseStatus: result.success ? 200 : 500,
            error: result.error,
            errorStack: result.errorStack,
            logs: result.logs.join("\n"),
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
            apiKeyId: apiKey.id,
          },
        });

        // Update function stats
        const duration = Date.now() - startTime;
        await prisma.function.update({
          where: { id: func.id },
          data: {
            invocations: { increment: 1 },
            lastInvoked: new Date(),
            avgDuration: func.avgDuration
              ? Math.round((func.avgDuration + duration) / 2)
              : duration,
            errorRate: result.success
              ? func.errorRate
                ? func.errorRate * 0.95
                : 0
              : func.errorRate
              ? Math.min(func.errorRate * 1.05 + 1, 100)
              : 1,
          },
        });

        // Return result
        if (result.success) {
          return reply.send({
            success: true,
            data: result.data,
            meta: {
              duration: result.duration,
              logs: result.logs,
            },
          });
        } else {
          return reply.status(500).send({
            success: false,
            error: result.error,
            meta: {
              duration: result.duration,
              logs: result.logs,
              status: result.status,
            },
          });
        }
      } catch (err: any) {
        fastify.log.error(err);

        // Try to log error
        try {
          const { projectSlug, functionSlug } = request.params as any;
          const project = (request as any).project;

          const func = await prisma.function.findUnique({
            where: {
              projectId_slug: {
                projectId: project.id,
                slug: functionSlug,
              },
            },
          });

          if (func) {
            await prisma.functionLog.create({
              data: {
                functionId: func.id,
                status: "ERROR",
                duration: Date.now() - startTime,
                requestBody: request.body || {},
                requestHeaders: request.headers,
                error: err.message,
                errorStack: err.stack,
                logs: "",
                ipAddress: request.ip,
              },
            });
          }
        } catch (logErr) {
          fastify.log.error("Failed to log error:", logErr as any);
        }

        return reply.status(500).send({
          success: false,
          error: "Function execution failed",
          details: err.message,
        });
      }
    }
  );

  /**
   * Invoke function via GET (for simple functions)
   * GET /api/invoke/:projectSlug/:functionSlug
   */
  fastify.get(
    "/:projectSlug/:functionSlug",
    {
      onRequest: [authenticateApiKey],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.FUNCTION_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.FUNCTION_RATE_LIMIT_WINDOW || "1 minute",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["functions"],
        summary: "Invoke function (GET)",
        description: "Execute a serverless function via GET request",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          required: ["projectSlug", "functionSlug"],
          properties: {
            projectSlug: { type: "string" },
            functionSlug: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const startTime = Date.now();

      try {
        const { projectSlug, functionSlug } = request.params as {
          projectSlug: string;
          functionSlug: string;
        };

        const project = (request as any).project;
        const apiKey = (request as any).apiKey;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get function
        const func = await prisma.function.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: functionSlug,
            },
          },
        });

        if (!func) {
          return reply.status(404).send({
            success: false,
            error: "Function not found",
          });
        }

        // Check if function is active
        if (func.status !== "ACTIVE") {
          return reply.status(400).send({
            success: false,
            error: `Function is ${func.status.toLowerCase()}`,
          });
        }

        // Execute function with query params as body
        const result = await runtimeService.execute(
          {
            id: func.id,
            sourceCode: func.sourceCode,
            entrypoint: func.entrypoint,
            timeout: func.timeout,
            memory: func.memory,
            envVars: (func.envVars as Record<string, string>) || {},
            projectId: project.id,
            projectSlug: project.slug,
          },
          prisma,
          {
            body: request.query, // Use query params as body for GET
            headers: request.headers as Record<string, string>,
            method: request.method,
            query: request.query as Record<string, string>,
            params: request.params as Record<string, string>,
          }
        );

        // Log execution
        await prisma.functionLog.create({
          data: {
            functionId: func.id,
            status: result.status,
            duration: result.duration,
            requestBody: request.query || {},
            requestHeaders: request.headers,
            requestMethod: request.method,
            requestQuery: request.query || {},
            responseBody: result.data || null,
            responseStatus: result.success ? 200 : 500,
            error: result.error,
            errorStack: result.errorStack,
            logs: result.logs.join("\n"),
            ipAddress: request.ip,
            userAgent: request.headers["user-agent"],
            apiKeyId: apiKey.id,
          },
        });

        // Update function stats
        const duration = Date.now() - startTime;
        await prisma.function.update({
          where: { id: func.id },
          data: {
            invocations: { increment: 1 },
            lastInvoked: new Date(),
            avgDuration: func.avgDuration
              ? Math.round((func.avgDuration + duration) / 2)
              : duration,
            errorRate: result.success
              ? func.errorRate
                ? func.errorRate * 0.95
                : 0
              : func.errorRate
              ? Math.min(func.errorRate * 1.05 + 1, 100)
              : 1,
          },
        });

        // Return result
        if (result.success) {
          return reply.send({
            success: true,
            data: result.data,
            meta: {
              duration: result.duration,
              logs: result.logs,
            },
          });
        } else {
          return reply.status(500).send({
            success: false,
            error: result.error,
            meta: {
              duration: result.duration,
              logs: result.logs,
              status: result.status,
            },
          });
        }
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Function execution failed",
          details: err.message,
        });
      }
    }
  );
}
