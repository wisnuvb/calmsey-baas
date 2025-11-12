import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { authenticate } from '../middleware/auth.middleware';
import { generateSlug } from '../lib/utils';
import { FieldType, CollectionSchema } from '../types';

// Validation schema for field definition
const fieldDefinitionSchema = z.object({
  name: z.string().min(1),
  type: z.nativeEnum(FieldType),
  required: z.boolean().optional().default(false),
  unique: z.boolean().optional().default(false),
  default: z.any().optional(),
  validation: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    pattern: z.string().optional(),
    enum: z.array(z.string()).optional(),
  }).optional(),
  relation: z.object({
    collection: z.string(),
    type: z.enum(['one-to-one', 'one-to-many', 'many-to-many']),
  }).optional(),
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
  schema: z.object({
    fields: z.array(fieldDefinitionSchema),
    timestamps: z.boolean().optional(),
    softDelete: z.boolean().optional(),
  }).optional(),
});

export async function collectionRoutes(fastify: FastifyInstance) {
  // Get all collections for a project
  fastify.get('/', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    try {
      const { projectId } = request.query as { projectId: string };
      const userId = (request.user as any).id;

      if (!projectId) {
        return reply.status(400).send({
          success: false,
          error: 'projectId is required',
        });
      }

      // Verify project belongs to user
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
      });

      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found',
        });
      }

      const collections = await prisma.collection.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });

      return reply.send({
        success: true,
        data: collections,
      });
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch collections',
      });
    }
  });

  // Get single collection
  fastify.get('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
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
          error: 'Collection not found',
        });
      }

      return reply.send({
        success: true,
        data: collection,
      });
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to fetch collection',
      });
    }
  });

  // Create new collection
  fastify.post('/', {
    onRequest: [authenticate],
  }, async (request, reply) => {
    try {
      const body = createCollectionSchema.parse(request.body);
      const { projectId } = request.query as { projectId: string };
      const userId = (request.user as any).id;

      if (!projectId) {
        return reply.status(400).send({
          success: false,
          error: 'projectId is required',
        });
      }

      // Verify project belongs to user
      const project = await prisma.project.findFirst({
        where: { id: projectId, userId },
      });

      if (!project) {
        return reply.status(404).send({
          success: false,
          error: 'Project not found',
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
      
      // Add default fields if timestamps enabled
      if (schema.timestamps) {
        schema.fields.push(
          { name: 'createdAt', type: FieldType.DATETIME, required: false },
          { name: 'updatedAt', type: FieldType.DATETIME, required: false }
        );
      }

      // Add deletedAt if soft delete enabled
      if (schema.softDelete) {
        schema.fields.push(
          { name: 'deletedAt', type: FieldType.DATETIME, required: false }
        );
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

      return reply.status(201).send({
        success: true,
        data: collection,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: err.errors,
        });
      }

      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Failed to create collection',
      });
    }
  });

  // Update collection
  fastify.patch('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
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
          error: 'Collection not found',
        });
      }

      // Update collection
      const updateData: any = {};
      
      if (body.name) {
        updateData.name = body.name;
      }

      if (body.schema) {
        const schema: CollectionSchema = body.schema;
        
        // Add default fields if timestamps enabled
        if (schema.timestamps) {
          const hasCreatedAt = schema.fields.some(f => f.name === 'createdAt');
          const hasUpdatedAt = schema.fields.some(f => f.name === 'updatedAt');
          
          if (!hasCreatedAt) {
            schema.fields.push({ name: 'createdAt', type: FieldType.DATETIME, required: false });
          }
          if (!hasUpdatedAt) {
            schema.fields.push({ name: 'updatedAt', type: FieldType.DATETIME, required: false });
          }
        }

        // Add deletedAt if soft delete enabled
        if (schema.softDelete) {
          const hasDeletedAt = schema.fields.some(f => f.name === 'deletedAt');
          if (!hasDeletedAt) {
            schema.fields.push({ name: 'deletedAt', type: FieldType.DATETIME, required: false });
          }
        }

        updateData.schema = schema;
      }

      const collection = await prisma.collection.update({
        where: { id },
        data: updateData,
      });

      return reply.send({
        success: true,
        data: collection,
      });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          error: 'Validation error',
          details: err.errors,
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to update collection',
      });
    }
  });

  // Delete collection
  fastify.delete('/:id', {
    onRequest: [authenticate],
  }, async (request, reply) => {
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
          error: 'Collection not found',
        });
      }

      // Delete collection
      await prisma.collection.delete({
        where: { id },
      });

      return reply.send({
        success: true,
        message: 'Collection deleted successfully',
      });
    } catch (err) {
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete collection',
      });
    }
  });
}
