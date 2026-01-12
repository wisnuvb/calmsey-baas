import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import {
  authenticateApiKey,
  authenticateDynamicRequest,
} from "../middleware/auth.middleware";
import { DynamicQueryBuilder } from "../lib/dynamic-query-builder";
import { CollectionSchema, QueryParams, AccessControlRules } from "../types";
import {
  createRateLimitConfig,
  rateLimitByApiKey,
} from "../middleware/rate-limit.middleware";
import { DataExportService } from "../lib/data-export.service";
import { DataImportService } from "../lib/data-import.service";

export async function dynamicApiRoutes(fastify: FastifyInstance) {
  /**
   * Dynamic CRUD endpoints
   * Format: /api/data/:projectSlug/:collectionSlug
   *
   * Requires X-API-Key header for authentication
   */

  // Rate limit config for dynamic API (per API key)
  const apiRateLimit = createRateLimitConfig({
    max: parseInt(process.env.API_RATE_LIMIT_MAX || "1000"), // 1000 requests
    timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
    keyGenerator: rateLimitByApiKey,
  });

  // List items (GET /api/data/:projectSlug/:collectionSlug)
  fastify.get(
    "/:projectSlug/:collectionSlug",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: apiRateLimit,
      },
      schema: {
        tags: ["data"],
        summary: "List items",
        description: "Get list of items from a collection",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          properties: {
            projectSlug: { type: "string" },
            collectionSlug: { type: "string" },
          },
        },
        querystring: {
          type: "object",
          properties: {
            page: { type: "number", minimum: 1 },
            limit: { type: "number", minimum: 1, maximum: 100 },
            sort: { type: "string" },
            order: { type: "string", enum: ["asc", "desc"] },
            search: { type: "string" },
            populate: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const queryParams = request.query as any;
        const populate = queryParams.populate
          ? Array.isArray(queryParams.populate)
            ? queryParams.populate
            : [queryParams.populate]
          : undefined;

        const project = (request as any).project;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get collection
        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Build query
        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        // Parse query parameters
        const params: QueryParams = {
          page: queryParams.page ? parseInt(queryParams.page) : 1,
          limit: queryParams.limit ? parseInt(queryParams.limit) : 10,
          sort: queryParams.sort || "createdAt",
          order: queryParams.order || "desc",
          filter: queryParams.filter ? JSON.parse(queryParams.filter) : {},
          search: queryParams.search || undefined,
          populate: queryParams.populate
            ? Array.isArray(queryParams.populate)
              ? queryParams.populate
              : [queryParams.populate]
            : undefined,
        };

        const result = await queryBuilder.findMany(params);

        return reply.send({
          success: true,
          data: result.data,
          meta: {
            total: result.total,
            page: params.page,
            limit: params.limit,
            totalPages: Math.ceil(result.total / params.limit!),
          },
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch data",
        });
      }
    }
  );

  // Get single item (GET /api/data/:projectSlug/:collectionSlug/:id)
  fastify.get(
    "/:projectSlug/:collectionSlug/:id",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: apiRateLimit,
      },
      schema: {
        tags: ["data"],
        summary: "Get single item",
        description: "Retrieve a single item by its ID",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          required: ["projectSlug", "collectionSlug", "id"],
          properties: {
            projectSlug: { type: "string" },
            collectionSlug: { type: "string" },
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
                additionalProperties: true,
              },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug, id } = request.params as {
          projectSlug: string;
          collectionSlug: string;
          id: string;
        };

        const project = (request as any).project;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get collection
        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Build query
        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const queryParams = request.query as any;
        const populate = queryParams.populate
          ? Array.isArray(queryParams.populate)
            ? queryParams.populate
            : [queryParams.populate]
          : undefined;

        const item = await queryBuilder.findById(id, populate);

        if (!item) {
          return reply.status(404).send({
            success: false,
            error: "Item not found",
          });
        }

        return reply.send({
          success: true,
          data: item,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch item",
        });
      }
    }
  );

  // Create item (POST /api/data/:projectSlug/:collectionSlug)
  fastify.post(
    "/:projectSlug/:collectionSlug",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Create new item",
        description: "Create a new item in a collection",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          required: ["projectSlug", "collectionSlug"],
          properties: {
            projectSlug: { type: "string" },
            collectionSlug: { type: "string" },
          },
        },
        body: {
          type: "object",
          additionalProperties: true, // Allow any properties based on collection schema
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                additionalProperties: true,
              },
            },
          },
          400: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
              details: { type: "object" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const data = request.body as Record<string, any>;
        const project = (request as any).project;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get collection
        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Build query
        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        // Log for debugging
        fastify.log.debug({
          msg: "Creating item",
          projectSlug,
          collectionSlug,
          data,
          schemaFields: schema.fields?.map((f: any) => f.name),
        });

        const item = await queryBuilder.insert(data);

        return reply.status(201).send({
          success: true,
          data: item,
        });
      } catch (err: any) {
        fastify.log.error({
          error: err,
          message: err.message,
          stack: err.stack,
          data: request.body,
        });

        // Handle JSON parsing errors
        if (err instanceof SyntaxError || err.message?.includes("JSON")) {
          return reply.status(400).send({
            success: false,
            error: "Invalid JSON format",
            details: {
              message: err.message || "Failed to parse request body",
            },
          });
        }

        // Better error handling for validation errors
        if (err.message && err.message.includes("Validation failed")) {
          return reply.status(400).send({
            success: false,
            error: "Validation failed",
            details: {
              message: err.message,
              errors: err.message.split(": ")[1]?.split(", ") || [],
            },
          });
        }

        // Handle database constraint errors
        if (err.code === "23505") {
          // Unique constraint violation
          return reply.status(400).send({
            success: false,
            error: "Duplicate entry",
            details: {
              message: err.message || "A record with this value already exists",
              constraint: err.constraint,
            },
          });
        }

        if (err.code === "23503") {
          // Foreign key constraint violation
          return reply.status(400).send({
            success: false,
            error: "Invalid reference",
            details: {
              message: err.message || "Referenced record does not exist",
            },
          });
        }

        // Handle other validation errors
        if (err.message) {
          return reply.status(400).send({
            success: false,
            error: "Bad Request",
            details: {
              message: err.message,
              code: err.code,
            },
          });
        }

        return reply.status(500).send({
          success: false,
          error: "Failed to create item",
          details: {
            message: err?.message || "Unknown error occurred",
          },
        });
      }
    }
  );

  // Update item (PATCH /api/data/:projectSlug/:collectionSlug/:id)
  fastify.patch(
    "/:projectSlug/:collectionSlug/:id",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Update item",
        description: "Update an existing item in a collection",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          required: ["projectSlug", "collectionSlug", "id"],
          properties: {
            projectSlug: { type: "string" },
            collectionSlug: { type: "string" },
            id: { type: "string" },
          },
        },
        body: {
          type: "object",
          additionalProperties: true, // Allow any properties based on collection schema
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                },
                additionalProperties: true,
              },
              migration: {
                type: "object",
                properties: {
                  applied: { type: "boolean" },
                  changes: { type: "number" },
                  warnings: { type: "array", items: { type: "string" } },
                },
              },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug, id } = request.params as {
          projectSlug: string;
          collectionSlug: string;
          id: string;
        };

        const data = request.body as Record<string, any>;
        const project = (request as any).project;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get collection
        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Build query
        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const item = await queryBuilder.update(id, data);

        if (!item) {
          return reply.status(404).send({
            success: false,
            error: "Item not found",
          });
        }

        return reply.send({
          success: true,
          data: item,
        });
      } catch (err: any) {
        fastify.log.error(err);

        if (err.message && err.message.includes("Validation failed")) {
          return reply.status(400).send({
            success: false,
            error: err.message,
          });
        }

        return reply.status(500).send({
          success: false,
          error: "Failed to update item",
        });
      }
    }
  );

  // Delete item (DELETE /api/data/:projectSlug/:collectionSlug/:id)
  fastify.delete(
    "/:projectSlug/:collectionSlug/:id",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Delete item",
        description: "Delete an existing item from a collection",
        security: [{ apiKeyAuth: [] }],
        params: {
          type: "object",
          required: ["projectSlug", "collectionSlug", "id"],
          properties: {
            projectSlug: { type: "string" },
            collectionSlug: { type: "string" },
            id: { type: "string" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              message: { type: "string" },
            },
          },
          404: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              error: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug, id } = request.params as {
          projectSlug: string;
          collectionSlug: string;
          id: string;
        };

        const project = (request as any).project;

        // Verify project slug matches
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get collection
        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Build query
        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const deleted = await queryBuilder.delete(id);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: "Item not found",
          });
        }

        return reply.send({
          success: true,
          message: "Item deleted successfully",
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to delete item",
        });
      }
    }
  );

  // Bulk create (POST /api/data/:projectSlug/:collectionSlug/bulk)
  fastify.post(
    "/:projectSlug/:collectionSlug/bulk",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Bulk create items",
        description: "Create multiple items in a single request",
        security: [{ apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["data"],
          properties: {
            data: {
              type: "array",
              items: { type: "object" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const body = request.body as { data: Record<string, any>[] };
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const results = [];
        const errors = [];

        for (let i = 0; i < body.data.length; i++) {
          try {
            const item = await queryBuilder.insert(body.data[i]);
            results.push(item);
          } catch (err: any) {
            errors.push({
              index: i,
              error: err.message,
              data: body.data[i],
            });
          }
        }

        return reply.status(201).send({
          success: true,
          created: results.length,
          failed: errors.length,
          data: results,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to bulk create items",
        });
      }
    }
  );

  // Bulk update (PATCH /api/data/:projectSlug/:collectionSlug/bulk)
  fastify.patch(
    "/:projectSlug/:collectionSlug/bulk",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Bulk update items",
        description: "Update multiple items matching filter",
        security: [{ apiKeyAuth: [] }],
        body: {
          type: "object",
          required: ["where", "data"],
          properties: {
            where: { type: "object" },
            data: { type: "object" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const body = request.body as {
          where: Record<string, any>;
          data: Record<string, any>;
        };
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        // Find items matching filter
        const findResult = await queryBuilder.findMany({
          filter: body.where,
          limit: 1000, // Max bulk update limit
        });

        let updated = 0;
        const errors = [];

        for (const item of findResult.data) {
          try {
            await queryBuilder.update(item.id, body.data);
            updated++;
          } catch (err: any) {
            errors.push({
              id: item.id,
              error: err.message,
            });
          }
        }

        return reply.send({
          success: true,
          updated,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to bulk update items",
        });
      }
    }
  );

  // Bulk delete (DELETE /api/data/:projectSlug/:collectionSlug/bulk)
  fastify.delete(
    "/:projectSlug/:collectionSlug/bulk",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Bulk delete items",
        description: "Delete multiple items matching filter",
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            filter: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const queryParams = request.query as any;
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const filter = queryParams.filter ? JSON.parse(queryParams.filter) : {};

        // Find items matching filter
        const findResult = await queryBuilder.findMany({
          filter,
          limit: 1000, // Max bulk delete limit
        });

        let deleted = 0;
        const errors = [];

        for (const item of findResult.data) {
          try {
            await queryBuilder.delete(item.id);
            deleted++;
          } catch (err: any) {
            errors.push({
              id: item.id,
              error: err.message,
            });
          }
        }

        return reply.send({
          success: true,
          deleted,
          failed: errors.length,
          errors: errors.length > 0 ? errors : undefined,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to bulk delete items",
        });
      }
    }
  );

  // Count endpoint (GET /api/data/:projectSlug/:collectionSlug/count)
  fastify.get(
    "/:projectSlug/:collectionSlug/count",
    {
      onRequest: [authenticateDynamicRequest],
      schema: {
        tags: ["data"],
        summary: "Count items",
        description: "Get count of items matching filter",
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            filter: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const queryParams = request.query as any;
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const filter = queryParams.filter ? JSON.parse(queryParams.filter) : {};

        const result = await queryBuilder.findMany({
          filter,
          limit: 1, // We only need count
        });

        return reply.send({
          success: true,
          count: result.total,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to count items",
        });
      }
    }
  );

  // Aggregate endpoint (GET /api/data/:projectSlug/:collectionSlug/aggregate)
  fastify.get(
    "/:projectSlug/:collectionSlug/aggregate",
    {
      onRequest: [authenticateDynamicRequest],
      schema: {
        tags: ["data"],
        summary: "Aggregate data",
        description: "Get aggregated data with grouping and functions",
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            filter: { type: "string" },
            groupBy: { type: "string" },
            sum: { type: "string" },
            avg: { type: "string" },
            min: { type: "string" },
            max: { type: "string" },
            count: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const queryParams = request.query as any;
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const filter = queryParams.filter ? JSON.parse(queryParams.filter) : {};

        const groupBy = queryParams.groupBy
          ? queryParams.groupBy.split(",").map((f: string) => f.trim())
          : undefined;

        const functions: any = {};
        if (queryParams.sum) {
          functions.sum = queryParams.sum
            .split(",")
            .map((f: string) => f.trim());
        }
        if (queryParams.avg) {
          functions.avg = queryParams.avg
            .split(",")
            .map((f: string) => f.trim());
        }
        if (queryParams.min) {
          functions.min = queryParams.min
            .split(",")
            .map((f: string) => f.trim());
        }
        if (queryParams.max) {
          functions.max = queryParams.max
            .split(",")
            .map((f: string) => f.trim());
        }
        if (queryParams.count) {
          functions.count = queryParams.count
            .split(",")
            .map((f: string) => f.trim());
        }

        const result = await queryBuilder.aggregate({
          filter,
          groupBy,
          functions: Object.keys(functions).length > 0 ? functions : undefined,
        });

        return reply.send({
          success: true,
          data: result,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(400).send({
          success: false,
          error: err.message || "Failed to aggregate data",
        });
      }
    }
  );

  // Stats endpoint (GET /api/data/:projectSlug/:collectionSlug/stats)
  fastify.get(
    "/:projectSlug/:collectionSlug/stats",
    {
      onRequest: [authenticateDynamicRequest],
      schema: {
        tags: ["data"],
        summary: "Get collection statistics",
        description: "Get statistics and summary for collection",
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            filter: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const queryParams = request.query as any;
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const filter = queryParams.filter
          ? JSON.parse(queryParams.filter)
          : undefined;

        const stats = await queryBuilder.getStats(filter);

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to get statistics",
        });
      }
    }
  );

  // Export endpoint (GET /api/data/:projectSlug/:collectionSlug/export)
  fastify.get(
    "/:projectSlug/:collectionSlug/export",
    {
      onRequest: [authenticateDynamicRequest],
      schema: {
        tags: ["data"],
        summary: "Export data",
        description: "Export collection data to JSON, CSV, or XLSX",
        security: [{ apiKeyAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            format: {
              type: "string",
              enum: ["json", "csv", "xlsx"],
              default: "json",
            },
            filter: { type: "string" },
            fields: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const queryParams = request.query as any;
        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const format = (queryParams.format || "json") as
          | "json"
          | "csv"
          | "xlsx";
        const filter = queryParams.filter ? JSON.parse(queryParams.filter) : {};
        const fields = queryParams.fields
          ? (Array.isArray(queryParams.fields)
              ? queryParams.fields
              : queryParams.fields.split(",")
            ).map((f: string) => f.trim())
          : undefined;

        const exportService = new DataExportService(prisma, queryBuilder);
        const buffer = await exportService.export(format, {
          filter,
          fields,
        });

        const filename = `${collectionSlug}_${
          new Date().toISOString().split("T")[0]
        }.${exportService.getFileExtension(format)}`;

        return reply
          .type(exportService.getMimeType(format))
          .header("Content-Disposition", `attachment; filename="${filename}"`)
          .send(buffer);
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to export data",
        });
      }
    }
  );

  // Import endpoint (POST /api/data/:projectSlug/:collectionSlug/import)
  fastify.post(
    "/:projectSlug/:collectionSlug/import",
    {
      onRequest: [authenticateDynamicRequest],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.API_WRITE_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.API_RATE_LIMIT_WINDOW || "1 hour",
          keyGenerator: rateLimitByApiKey,
        }),
      },
      schema: {
        tags: ["data"],
        summary: "Import data",
        description: "Import data from JSON, CSV, or XLSX file",
        security: [{ apiKeyAuth: [] }],
        consumes: ["multipart/form-data"],
      },
    },
    async (request, reply) => {
      try {
        const { projectSlug, collectionSlug } = request.params as {
          projectSlug: string;
          collectionSlug: string;
        };

        const project = (request as any).project;

        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        const collection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId: project.id,
              slug: collectionSlug,
            },
          },
        });

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const schema = collection.schema as unknown as CollectionSchema;
        const queryBuilder = new DynamicQueryBuilder(
          prisma,
          project.id,
          collectionSlug,
          schema
        ).setAccessControl(
          (request as any).accessContext,
          (collection as any).rules
        );

        const data = await request.file();
        if (!data) {
          return reply.status(400).send({
            success: false,
            error: "No file provided",
          });
        }

        // Determine format from file extension
        const filename = data.filename || "";
        let format: "json" | "csv" | "xlsx" = "json";
        if (filename.endsWith(".csv")) {
          format = "csv";
        } else if (filename.endsWith(".xlsx") || filename.endsWith(".xls")) {
          format = "xlsx";
        } else if (filename.endsWith(".json")) {
          format = "json";
        }

        // Read file buffer
        const chunks: Buffer[] = [];
        for await (const chunk of data.file) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);

        const importService = new DataImportService(prisma, queryBuilder);
        const result = await importService.import(buffer, format, {
          skipErrors: true,
          batchSize: 100,
        });

        return reply.send({
          success: true,
          imported: result.imported,
          failed: result.failed,
          errors: result.errors.length > 0 ? result.errors : undefined,
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to import data",
        });
      }
    }
  );
}
