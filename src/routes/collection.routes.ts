import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { generateSlug } from "../lib/utils";
import { FieldType, CollectionSchema } from "../types";
import { DynamicQueryBuilder } from "../lib/dynamic-query-builder";
import {
  createRateLimitConfig,
  rateLimitByUserId,
} from "../middleware/rate-limit.middleware";
import { SchemaMigrationService } from "../lib/schema-migration.service";

// Validation schema for field definition
const fieldDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(FieldType),
  required: z.boolean().optional().default(false),
  unique: z.boolean().optional().default(false),
  indexed: z.boolean().optional().default(false),
  default: z.any().optional(),
  validation: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      pattern: z.string().optional(),
      enum: z.array(z.string()).optional(),
    })
    .optional(),
  relation: z
    .object({
      collection: z.string(),
      type: z.enum(["one-to-one", "one-to-many", "many-to-many"]),
    })
    .optional(),
});

const createCollectionSchema = z.object({
  name: z.string().min(1),
  schema: z.object({
    fields: z.array(fieldDefinitionSchema),
    timestamps: z.boolean().optional().default(true),
    softDelete: z.boolean().optional().default(false),
  }),
});

const updateCollectionSchema = z.object({
  name: z.string().min(1).optional(),
  schema: z
    .object({
      fields: z.array(fieldDefinitionSchema),
      timestamps: z.boolean().optional(),
      softDelete: z.boolean().optional(),
    })
    .optional(),
});

export async function collectionRoutes(fastify: FastifyInstance) {
  // Rate limit untuk collection management
  const collectionRateLimit = createRateLimitConfig({
    max: parseInt(process.env.COLLECTION_RATE_LIMIT_MAX || "50"),
    timeWindow: process.env.COLLECTION_RATE_LIMIT_WINDOW || "1 minute",
    keyGenerator: rateLimitByUserId,
  });

  // Get all collections for a project
  fastify.get(
    "/",
    {
      onRequest: [authenticate],
      config: {
        rateLimit: collectionRateLimit,
      },
      schema: {
        tags: ["collections"],
        summary: "Get all collections",
        description: "Retrieve all collections for a project",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        // Remove response schema validation to allow dynamic schema
        // response: { ... }
      },
    },
    async (request, reply) => {
      try {
        const { projectId } = request.query as { projectId: string };
        const userId = (request.user as any).id;

        if (!projectId) {
          return reply.status(400).send({
            success: false,
            error: "projectId is required",
          });
        }

        // Verify project belongs to user
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        const collections = await prisma.collection.findMany({
          where: { projectId },
          orderBy: { createdAt: "desc" },
        });

        // Ensure schema is properly serialized
        const serializedCollections = collections.map((collection) => {
          // Force serialization by parsing and stringifying
          // This ensures Prisma JsonValue is converted to plain object
          let schema = collection.schema;

          // Convert Prisma JsonValue to plain object
          if (schema !== null && schema !== undefined) {
            try {
              // If it's already an object, stringify and parse to ensure it's clean
              schema = JSON.parse(JSON.stringify(schema));
            } catch (e) {
              // If it's a string, parse it
              if (typeof schema === "string") {
                try {
                  schema = JSON.parse(schema);
                } catch (parseError) {
                  console.error("Failed to parse schema:", parseError);
                  schema = {};
                }
              } else {
                // Fallback to empty object if serialization fails
                schema = {};
              }
            }
          } else {
            schema = {};
          }

          console.log("Raw collection schema:", collection.schema);
          console.log("Schema type:", typeof collection.schema);
          console.log("Schema value:", JSON.stringify(collection.schema));
          console.log("Processed schema:", schema);
          console.log("Processed schema type:", typeof schema);

          const result = {
            id: collection.id,
            name: collection.name,
            slug: collection.slug,
            schema: schema,
            projectId: collection.projectId,
            createdAt: collection.createdAt.toISOString(),
            updatedAt: collection.updatedAt.toISOString(),
          };

          console.log("Final result schema:", result.schema);
          return result;
        });

        console.log(
          "Serialized collections:",
          JSON.stringify(serializedCollections, null, 2)
        );

        return reply.type("application/json").send({
          success: true,
          data: serializedCollections,
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch collections",
        });
      }
    }
  );

  // Get single collection
  fastify.get(
    "/:id",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["collections"],
        summary: "Get collection by ID",
        description: "Retrieve a single collection by its ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
            id: {
              type: "string",
              description: "Collection ID",
            },
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
                  name: { type: "string" },
                  slug: { type: "string" },
                  schema: {
                    type: "object",
                    additionalProperties: true,
                  },
                  projectId: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                  updatedAt: { type: "string", format: "date-time" },
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
        const { id } = request.params as { id: string };
        const userId = (request.user as any).id;

        const collection = await prisma.collection.findFirst({
          where: {
            id,
            project: { userId },
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

        if (!collection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Ensure schema is properly serialized
        let schema = collection.schema;

        // Convert Prisma JsonValue to plain object
        if (schema !== null && schema !== undefined) {
          try {
            // Force serialization by parsing and stringifying
            schema = JSON.parse(JSON.stringify(schema));
          } catch (e) {
            // If it's a string, parse it
            if (typeof schema === "string") {
              try {
                schema = JSON.parse(schema);
              } catch (parseError) {
                console.error("Failed to parse schema:", parseError);
                schema = {};
              }
            } else {
              schema = {};
            }
          }
        } else {
          schema = {};
        }

        const serializedCollection = {
          id: collection.id,
          name: collection.name,
          slug: collection.slug,
          schema: schema,
          projectId: collection.projectId,
          createdAt: collection.createdAt.toISOString(),
          updatedAt: collection.updatedAt.toISOString(),
          project: collection.project,
        };

        return reply.send({
          success: true,
          data: serializedCollection,
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch collection",
        });
      }
    }
  );

  // Create new collection
  fastify.post(
    "/",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["collections"],
        summary: "Create new collection",
        description: "Create a new collection with schema definition",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          required: ["projectId"],
          properties: {
            projectId: {
              type: "string",
              description: "Project ID",
            },
          },
        },
        body: {
          type: "object",
          required: ["name", "schema"],
          properties: {
            name: {
              type: "string",
              description: "Collection name",
            },
            schema: {
              type: "object",
              required: ["fields"],
              properties: {
                fields: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      name: { type: "string" },
                      type: {
                        type: "string",
                        enum: [
                          "string",
                          "text",
                          "number",
                          "boolean",
                          "date",
                          "datetime",
                          "email",
                          "url",
                          "json",
                          "relation",
                          "file",
                        ],
                      },
                      required: { type: "boolean" },
                      unique: { type: "boolean" },
                      indexed: { type: "boolean" },
                      default: {},
                      validation: {
                        type: "object",
                        properties: {
                          min: { type: "number" },
                          max: { type: "number" },
                          pattern: { type: "string" },
                          enum: { type: "array", items: { type: "string" } },
                        },
                      },
                      relation: {
                        type: "object",
                        properties: {
                          collection: { type: "string" },
                          type: {
                            type: "string",
                            enum: ["one-to-one", "one-to-many", "many-to-many"],
                          },
                        },
                      },
                    },
                  },
                },
                timestamps: { type: "boolean" },
                softDelete: { type: "boolean" },
              },
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
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
        const body = createCollectionSchema.parse(request.body);
        const { projectId } = request.query as { projectId: string };
        const userId = (request.user as any).id;

        if (!projectId) {
          return reply.status(400).send({
            success: false,
            error: "projectId is required",
          });
        }

        // Verify project belongs to user
        const project = await prisma.project.findFirst({
          where: { id: projectId, userId },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        // Generate unique slug for collection
        let slug = generateSlug(body.name);
        const existingCollection = await prisma.collection.findUnique({
          where: {
            projectId_slug: {
              projectId,
              slug,
            },
          },
        });

        if (existingCollection) {
          slug = `${slug}-${Date.now()}`;
        }

        // Validate schema
        const schema: CollectionSchema = body.schema;

        // Prevent manual 'id' field (it's automatically created)
        const hasIdField = schema.fields.some(
          (f) => f.name.toLowerCase() === "id"
        );
        if (hasIdField) {
          return reply.status(400).send({
            success: false,
            error:
              "Field 'id' is automatically created. Please remove it from your schema.",
          });
        }

        // Add default fields if timestamps enabled
        if (schema.timestamps) {
          schema.fields.push(
            { name: "createdAt", type: FieldType.DATETIME, required: false },
            { name: "updatedAt", type: FieldType.DATETIME, required: false }
          );
        }

        // Add deletedAt if soft delete enabled
        if (schema.softDelete) {
          schema.fields.push({
            name: "deletedAt",
            type: FieldType.DATETIME,
            required: false,
          });
        }

        // Create collection
        const collection = await prisma.collection.create({
          data: {
            name: body.name,
            slug,
            schema: schema as any,
            projectId,
          },
        });

        // Create table immediately after collection is created
        try {
          const queryBuilder = new DynamicQueryBuilder(
            prisma,
            projectId,
            slug,
            schema
          );
          await queryBuilder.createTable();
        } catch (tableError: any) {
          // If table creation fails, delete the collection and return error
          await prisma.collection.delete({
            where: { id: collection.id },
          });
          fastify.log.error("Table creation failed:", tableError);
          return reply.status(500).send({
            success: false,
            error: `Failed to create table: ${
              tableError.message || "Unknown error"
            }`,
          });
        }

        return reply.status(201).send({
          success: true,
          data: collection,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation error",
            details: err.errors,
          });
        }

        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to create collection",
        });
      }
    }
  );

  // Update collection
  fastify.patch(
    "/:id",
    {
      onRequest: [authenticate],
      config: {
        rateLimit: collectionRateLimit,
      },
      schema: {
        tags: ["collections"],
        summary: "Update collection",
        description: "Update collection schema (triggers migration)",
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
            schema: {
              type: "object",
              properties: {
                fields: { type: "array" },
                timestamps: { type: "boolean" },
                softDelete: { type: "boolean" },
              },
            },
            allowDataLoss: { type: "boolean" },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: { type: "object" },
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
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateCollectionSchema.parse(request.body);
        const userId = (request.user as any).id;

        // Check if collection exists and belongs to user
        const existingCollection = await prisma.collection.findFirst({
          where: {
            id,
            project: { userId },
          },
        });

        if (!existingCollection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Update collection
        const updateData: any = {};
        let migrationResult: any = null; // Declare outside if block

        if (body.name) {
          updateData.name = body.name;
        }

        if (body.schema) {
          const schema: CollectionSchema = body.schema;
          const oldSchema =
            existingCollection.schema as unknown as CollectionSchema;

          // Add default fields if timestamps enabled
          if (schema.timestamps) {
            const hasCreatedAt = schema.fields.some(
              (f) => f.name === "createdAt"
            );
            const hasUpdatedAt = schema.fields.some(
              (f) => f.name === "updatedAt"
            );

            if (!hasCreatedAt) {
              schema.fields.push({
                name: "createdAt",
                type: FieldType.DATETIME,
                required: false,
              });
            }
            if (!hasUpdatedAt) {
              schema.fields.push({
                name: "updatedAt",
                type: FieldType.DATETIME,
                required: false,
              });
            }
          }

          // Handle soft delete changes
          const oldSoftDelete = oldSchema.softDelete ?? false;
          const newSoftDelete = schema.softDelete ?? false;

          if (newSoftDelete && !oldSoftDelete) {
            // Enable soft delete - add deletedAt field if not exists
            const hasDeletedAt = schema.fields.some(
              (f) => f.name === "deletedAt"
            );
            if (!hasDeletedAt) {
              schema.fields.push({
                name: "deletedAt",
                type: FieldType.DATETIME,
                required: false,
              });
            }
          } else if (!newSoftDelete && oldSoftDelete) {
            // Disable soft delete - remove deletedAt field from schema
            schema.fields = schema.fields.filter((f) => f.name !== "deletedAt");
          } else if (newSoftDelete) {
            // Keep soft delete enabled - ensure deletedAt exists
            const hasDeletedAt = schema.fields.some(
              (f) => f.name === "deletedAt"
            );
            if (!hasDeletedAt) {
              schema.fields.push({
                name: "deletedAt",
                type: FieldType.DATETIME,
                required: false,
              });
            }
          }

          updateData.schema = schema;

          // Perform schema migration
          const migrationService = new SchemaMigrationService(
            prisma,
            existingCollection.projectId,
            existingCollection.slug
          );

          // Get migration options from query params or body
          const allowDataLoss =
            (request.query as any)?.allowDataLoss === "true" ||
            (request.body as any)?.allowDataLoss === true;

          migrationResult = await migrationService.executeMigration(
            oldSchema,
            schema,
            {
              safeMode: true,
              allowDataLoss,
              dryRun: false,
            }
          );

          // Handle soft delete column changes separately
          if (oldSoftDelete !== newSoftDelete) {
            const tableName = `data_${existingCollection.projectId.replace(
              /-/g,
              "_"
            )}_${existingCollection.slug}`;

            if (newSoftDelete && !oldSoftDelete) {
              // Add deletedAt column
              try {
                await prisma.$executeRawUnsafe(`
                  ALTER TABLE "${tableName}" 
                  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP;
                `);
                fastify.log.info(`Added deletedAt column to ${tableName}`);
              } catch (colError: any) {
                fastify.log.error(`Failed to add deletedAt column:`, colError);
              }
            } else if (!newSoftDelete && oldSoftDelete) {
              // Remove deletedAt column (optional - might want to keep for data retention)
              // Uncomment if you want to remove the column
              /*
              try {
                await prisma.$executeRawUnsafe(`
                  ALTER TABLE "${tableName}" 
                  DROP COLUMN IF EXISTS "deletedAt";
                `);
                fastify.log.info(`Removed deletedAt column from ${tableName}`);
              } catch (colError: any) {
                fastify.log.error(`Failed to remove deletedAt column:`, colError);
              }
              */
              // Or just clear all deletedAt values
              try {
                await prisma.$executeRawUnsafe(`
                  UPDATE "${tableName}" 
                  SET "deletedAt" = NULL 
                  WHERE "deletedAt" IS NOT NULL;
                `);
                fastify.log.info(`Cleared deletedAt values in ${tableName}`);
              } catch (colError: any) {
                fastify.log.error(
                  `Failed to clear deletedAt values:`,
                  colError
                );
              }
            }
          }

          if (!migrationResult.success) {
            return reply.status(400).send({
              success: false,
              error: "Schema migration failed",
              details: {
                errors: migrationResult.errors,
                warnings: migrationResult.warnings,
                changes: migrationResult.changes.map((c: any) => ({
                  type: c.type,
                  field: c.field.name,
                })),
              },
            });
          }

          // Log warnings if any
          if (migrationResult.warnings && migrationResult.warnings.length > 0) {
            fastify.log.warn({
              msg: "Schema migration warnings",
              warnings: migrationResult.warnings,
            });
          }
        }

        const collection = await prisma.collection.update({
          where: { id },
          data: updateData,
        });

        return reply.send({
          success: true,
          data: collection,
          migration: migrationResult
            ? {
                applied: true,
                changes: migrationResult.changes?.length || 0,
                warnings: migrationResult.warnings || [],
              }
            : undefined,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation error",
            details: err.errors,
          });
        }

        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to update collection",
        });
      }
    }
  );

  // Preview schema migration (dry run)
  fastify.post(
    "/:id/migration/preview",
    {
      onRequest: [authenticate],
      config: {
        rateLimit: collectionRateLimit,
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateCollectionSchema.parse(request.body);
        const userId = (request.user as any).id;

        if (!body.schema) {
          return reply.status(400).send({
            success: false,
            error: "Schema is required for migration preview",
          });
        }

        // Check if collection exists
        const existingCollection = await prisma.collection.findFirst({
          where: {
            id,
            project: { userId },
          },
        });

        if (!existingCollection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        const oldSchema =
          existingCollection.schema as unknown as CollectionSchema;
        const newSchema = body.schema;

        // Prepare schema (add system fields)
        if (newSchema.timestamps) {
          if (!newSchema.fields.some((f) => f.name === "createdAt")) {
            newSchema.fields.push({
              name: "createdAt",
              type: FieldType.DATETIME,
              required: false,
              unique: false,
              indexed: false,
            });
          }
          if (!newSchema.fields.some((f) => f.name === "updatedAt")) {
            newSchema.fields.push({
              name: "updatedAt",
              type: FieldType.DATETIME,
              required: false,
              unique: false,
              indexed: false,
            });
          }
        }

        if (newSchema.softDelete) {
          if (!newSchema.fields.some((f) => f.name === "deletedAt")) {
            newSchema.fields.push({
              name: "deletedAt",
              type: FieldType.DATETIME,
              required: false,
              unique: false,
              indexed: false,
            });
          }
        }

        // Run migration preview
        const migrationService = new SchemaMigrationService(
          prisma,
          existingCollection.projectId,
          existingCollection.slug
        );

        const allowDataLoss = (request.query as any)?.allowDataLoss === "true";

        const migrationResult = await migrationService.executeMigration(
          oldSchema,
          newSchema,
          {
            safeMode: true,
            allowDataLoss,
            dryRun: true, // Preview only
          }
        );

        return reply.send({
          success: true,
          preview: true,
          migration: {
            changes: migrationResult.changes.map((c) => ({
              type: c.type,
              field: c.field.name,
              oldType: c.oldType,
              newType: c.field.type,
            })),
            sqlStatements: migrationResult.sqlStatements,
            warnings: migrationResult.warnings,
            errors: migrationResult.errors,
            willSucceed: migrationResult.success,
          },
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation error",
            details: err.errors,
          });
        }

        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to preview migration",
        });
      }
    }
  );

  // Delete collection
  fastify.delete(
    "/:id",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["collections"],
        summary: "Delete collection",
        description: "Delete collection and its table",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["id"],
          properties: {
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
        },
      },
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request.user as any).id;

        // Check if collection exists and belongs to user
        const existingCollection = await prisma.collection.findFirst({
          where: {
            id,
            project: { userId },
          },
        });

        if (!existingCollection) {
          return reply.status(404).send({
            success: false,
            error: "Collection not found",
          });
        }

        // Delete the physical table first
        const tableName = `data_${existingCollection.projectId.replace(
          /-/g,
          "_"
        )}_${existingCollection.slug}`;
        try {
          await prisma.$executeRawUnsafe(
            `DROP TABLE IF EXISTS "${tableName}";`
          );
        } catch (tableError: any) {
          fastify.log.warn(`Failed to drop table ${tableName}:`, tableError);
          // Continue with collection deletion even if table drop fails
        }

        // Delete collection record
        await prisma.collection.delete({
          where: { id },
        });

        return reply.send({
          success: true,
          message: "Collection and table deleted successfully",
        });
      } catch (err) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: "Failed to delete collection",
        });
      }
    }
  );
}
