import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth.middleware";
import { generateSlug, generateApiKey } from "../lib/utils";
import { DatabaseManagerService } from "../lib/database-manager.service";
import { DynamicQueryBuilder } from "../lib/dynamic-query-builder";
import { CollectionSchema, FieldType } from "../types";

// Initialize database manager
const dbManager = new DatabaseManagerService(prisma);

// Validation schemas
const createProjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  // Multi-database options
  useDedicatedDb: z.boolean().optional().default(false),
  useSameServer: z.boolean().optional().default(true),
  // Custom database config (optional, if not using same server)
  dbConfig: z
    .object({
      host: z.string(),
      port: z.number(),
      database: z.string(),
      username: z.string(),
      password: z.string(),
      type: z.enum(["postgresql", "mysql"]).optional(),
    })
    .optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
});

// Helper to create default 'users' collection for tenant auth
async function createDefaultCollections(project: any, prisma: any) {
  const usersSchema: CollectionSchema = {
    fields: [
      {
        name: "email",
        type: FieldType.EMAIL,
        required: true,
        unique: true,
        indexed: true,
      },
      { name: "password", type: FieldType.STRING, required: true }, // Hashed password
      {
        name: "role",
        type: FieldType.STRING,
        required: true,
        default: "user",
      }, // e.g. "SUPPLIER", "BUYER"
      { name: "name", type: FieldType.STRING, required: false },
      { name: "avatar", type: FieldType.URL, required: false },
      { name: "metadata", type: FieldType.JSON, required: false },
      { name: "createdAt", type: FieldType.DATETIME, required: false },
      { name: "updatedAt", type: FieldType.DATETIME, required: false },
    ],
    timestamps: true,
    softDelete: false,
  };

  try {
    await prisma.collection.create({
      data: {
        name: "Users",
        slug: "users",
        schema: usersSchema as any,
        projectId: project.id,
        rules: {
          read: "owner", // User can read own profile
          create: "public", // Registration is public
          update: "owner", // User can update own profile
          delete: "admin", // Only admin can delete users
        },
      },
    });

    // Create physical table
    const qb = new DynamicQueryBuilder(
      prisma,
      project.id,
      "users",
      usersSchema
    );
    await qb.createTable();
  } catch (error) {
    console.error("Failed to create default users collection:", error);
    // Don't fail the request, just log error
  }
}

export async function projectRoutes(fastify: FastifyInstance) {
  // Get all projects for current user
  fastify.get(
    "/",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const userId = (request.user as any).id;

        const projects = await prisma.project.findMany({
          where: { userId },
          include: {
            _count: {
              select: { collections: true, apiKeys: true },
            },
            settings: true,
          },
          orderBy: { createdAt: "desc" },
        });

        return reply.send({
          success: true,
          data: projects,
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch projects",
        });
      }
    }
  );

  // Get single project by ID
  fastify.get(
    "/:id",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request.user as any).id;

        const project = await prisma.project.findFirst({
          where: { id, userId },
          include: {
            collections: {
              orderBy: { createdAt: "desc" },
            },
            apiKeys: {
              select: {
                id: true,
                name: true,
                key: true,
                createdAt: true,
                lastUsed: true,
              },
            },
            settings: true,
          },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        return reply.send({
          success: true,
          data: project,
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch project",
        });
      }
    }
  );

  // Create new project
  fastify.post(
    "/",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const body = createProjectSchema.parse(request.body);
        const userId = (request.user as any).id;

        // Generate unique slug
        let slug = generateSlug(body.name);
        const existingProject = await prisma.project.findUnique({
          where: { slug },
        });

        if (existingProject) {
          slug = `${slug}-${Date.now()}`;
        }

        // Handle database creation if requested
        let dbConfig: any = null;
        let connectionUrl: string | null = null;

        if (body.useDedicatedDb) {
          try {
            // Create dedicated database
            dbConfig = await dbManager.createDatabase({
              projectId: "temp", // will be replaced after project creation
              projectSlug: slug,
              config: body.dbConfig,
              useSameServer: body.useSameServer,
            });

            // Build connection URL
            connectionUrl = dbManager.buildConnectionUrl(dbConfig);

            // Encrypt connection URL for storage
            const encryptedUrl = dbManager.encryptConnectionUrl(connectionUrl);

            // Initialize database schema
            await dbManager.initializeProjectDatabase("temp", connectionUrl);

            // Create project with database details
            const project = await prisma.project.create({
              data: {
                name: body.name,
                description: body.description,
                slug,
                userId,
                useDedicatedDb: true,
                dbConnectionUrl: encryptedUrl,
                dbHost: dbConfig.host,
                dbPort: dbConfig.port,
                dbName: dbConfig.database,
                dbUser: dbConfig.username,
                dbPassword: dbManager.encryptConnectionUrl(dbConfig.password), // encrypt password
                dbStatus: "ACTIVE",
                settings: {
                  create: {
                    authEnabled: true,
                    emailEnabled: false,
                    storageType: "local",
                  },
                },
                apiKeys: {
                  create: {
                    name: "Default API Key",
                    key: generateApiKey("sk"),
                    userId,
                  },
                },
              },
              include: {
                settings: true,
                apiKeys: true,
              },
            });

            // Initialize default collections (users)
            await createDefaultCollections(project, prisma);

            return reply.status(201).send({
              success: true,
              data: {
                ...project,
                database: {
                  host: dbConfig.host,
                  port: dbConfig.port,
                  name: dbConfig.database,
                  status: "ACTIVE",
                },
              },
            });
          } catch (dbErr: any) {
            fastify.log.error("Failed to create dedicated database:", dbErr);

            return reply.status(500).send({
              success: false,
              error: "Failed to create dedicated database",
              details: dbErr.message,
            });
          }
        } else {
          // Create project without dedicated database (use main database)
          const project = await prisma.project.create({
            data: {
              name: body.name,
              description: body.description,
              slug,
              userId,
              useDedicatedDb: false,
              settings: {
                create: {
                  authEnabled: true,
                  emailEnabled: false,
                  storageType: "local",
                },
              },
              apiKeys: {
                create: {
                  name: "Default API Key",
                  key: generateApiKey("sk"),
                  userId,
                },
              },
            },
            include: {
              settings: true,
              apiKeys: true,
            },
          });

          // Initialize default collections (users)
          await createDefaultCollections(project, prisma);

          return reply.status(201).send({
            success: true,
            data: project,
          });
        }
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation error",
            details: err.errors,
          });
        }

        fastify.log.error("Failed to create project:");
        return reply.status(500).send({
          success: false,
          error: "Failed to create project" as string,
        } as any);
      }
    }
  );

  // Update project
  fastify.patch(
    "/:id",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const body = updateProjectSchema.parse(request.body);
        const userId = (request.user as any).id;

        // Check if project exists and belongs to user
        const existingProject = await prisma.project.findFirst({
          where: { id, userId },
        });

        if (!existingProject) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        // Update project
        const project = await prisma.project.update({
          where: { id },
          data: body,
          include: {
            settings: true,
            _count: {
              select: { collections: true, apiKeys: true },
            },
          },
        });

        return reply.send({
          success: true,
          data: project,
        });
      } catch (err) {
        if (err instanceof z.ZodError) {
          return reply.status(400).send({
            success: false,
            error: "Validation error",
            details: err.errors,
          });
        }

        return reply.status(500).send({
          success: false,
          error: "Failed to update project",
        });
      }
    }
  );

  // Delete project
  fastify.delete(
    "/:id",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const userId = (request.user as any).id;

        // Check if project exists and belongs to user
        const existingProject = await prisma.project.findFirst({
          where: { id, userId },
        });

        if (!existingProject) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        // Delete project (cascade will delete collections and API keys)
        await prisma.project.delete({
          where: { id },
        });

        return reply.send({
          success: true,
          message: "Project deleted successfully",
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to delete project",
        });
      }
    }
  );

  // Create new API key for project
  fastify.post(
    "/:id/api-keys",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { name } = request.body as { name: string };
        const userId = (request.user as any).id;

        // Check if project exists and belongs to user
        const project = await prisma.project.findFirst({
          where: { id, userId },
        });

        if (!project) {
          return reply.status(404).send({
            success: false,
            error: "Project not found",
          });
        }

        // Create API key
        const apiKey = await prisma.apiKey.create({
          data: {
            name: name || "API Key",
            key: generateApiKey("sk"),
            projectId: id,
            userId,
          },
        });

        return reply.status(201).send({
          success: true,
          data: apiKey,
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to create API key",
        });
      }
    }
  );

  // Delete API key
  fastify.delete(
    "/:projectId/api-keys/:keyId",
    {
      onRequest: [authenticate],
    },
    async (request, reply) => {
      try {
        const { projectId, keyId } = request.params as {
          projectId: string;
          keyId: string;
        };
        const userId = (request.user as any).id;

        // Check if API key exists and belongs to user's project
        const apiKey = await prisma.apiKey.findFirst({
          where: {
            id: keyId,
            projectId,
            userId,
          },
        });

        if (!apiKey) {
          return reply.status(404).send({
            success: false,
            error: "API key not found",
          });
        }

        // Delete API key
        await prisma.apiKey.delete({
          where: { id: keyId },
        });

        return reply.send({
          success: true,
          message: "API key deleted successfully",
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to delete API key",
        });
      }
    }
  );
}
