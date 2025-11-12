import { FastifyInstance } from 'fastify';
import { prisma } from '../lib/prisma';
import { authenticateApiKey } from '../middleware/auth.middleware';
import { DynamicQueryBuilder } from '../lib/dynamic-query-builder';
import { CollectionSchema, QueryParams } from '../types';

export async function dynamicApiRoutes(fastify: FastifyInstance) {
  /**
   * Dynamic CRUD endpoints
   * Format: /api/data/:projectSlug/:collectionSlug
   * 
   * Requires X-API-Key header for authentication
   */

  // List items (GET /api/data/:projectSlug/:collectionSlug)
  fastify.get('/:projectSlug/:collectionSlug', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
    try {
      const { projectSlug, collectionSlug } = request.params as {
        projectSlug: string;
        collectionSlug: string;
      };

      const queryParams = request.query as any;
      const project = (request as any).project;

      // Verify project slug matches
      if (project.slug !== projectSlug) {
        return reply.status(403).send({
          success: false,
          error: 'Invalid project',
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
          error: 'Collection not found',
        });
      }

      // Build query
      const schema = collection.schema as unknown as CollectionSchema;
      const queryBuilder = new DynamicQueryBuilder(
        prisma,
        project.id,
        collectionSlug,
        schema
      );

      // Parse query parameters
      const params: QueryParams = {
        page: queryParams.page ? parseInt(queryParams.page) : 1,
        limit: queryParams.limit ? parseInt(queryParams.limit) : 10,
        sort: queryParams.sort || 'createdAt',
        order: queryParams.order || 'desc',
        filter: queryParams.filter ? JSON.parse(queryParams.filter) : {},
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
        error: 'Failed to fetch data',
      });
    }
  });

  // Get single item (GET /api/data/:projectSlug/:collectionSlug/:id)
  fastify.get('/:projectSlug/:collectionSlug/:id', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
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
          error: 'Invalid project',
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
          error: 'Collection not found',
        });
      }

      // Build query
      const schema = collection.schema as unknown as CollectionSchema;
      const queryBuilder = new DynamicQueryBuilder(
        prisma,
        project.id,
        collectionSlug,
        schema
      );

      const item = await queryBuilder.findById(id);

      if (!item) {
        return reply.status(404).send({
          success: false,
          error: 'Item not found',
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
        error: 'Failed to fetch item',
      });
    }
  });

  // Create item (POST /api/data/:projectSlug/:collectionSlug)
  fastify.post('/:projectSlug/:collectionSlug', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
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
          error: 'Invalid project',
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
          error: 'Collection not found',
        });
      }

      // Build query
      const schema = collection.schema as unknown as CollectionSchema;
      const queryBuilder = new DynamicQueryBuilder(
        prisma,
        project.id,
        collectionSlug,
        schema
      );

      const item = await queryBuilder.insert(data);

      return reply.status(201).send({
        success: true,
        data: item,
      });
    } catch (err: any) {
      fastify.log.error(err);
      
      if (err.message && err.message.includes('Validation failed')) {
        return reply.status(400).send({
          success: false,
          error: err.message,
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to create item',
      });
    }
  });

  // Update item (PATCH /api/data/:projectSlug/:collectionSlug/:id)
  fastify.patch('/:projectSlug/:collectionSlug/:id', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
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
          error: 'Invalid project',
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
          error: 'Collection not found',
        });
      }

      // Build query
      const schema = collection.schema as unknown as CollectionSchema;
      const queryBuilder = new DynamicQueryBuilder(
        prisma,
        project.id,
        collectionSlug,
        schema
      );

      const item = await queryBuilder.update(id, data);

      if (!item) {
        return reply.status(404).send({
          success: false,
          error: 'Item not found',
        });
      }

      return reply.send({
        success: true,
        data: item,
      });
    } catch (err: any) {
      fastify.log.error(err);

      if (err.message && err.message.includes('Validation failed')) {
        return reply.status(400).send({
          success: false,
          error: err.message,
        });
      }

      return reply.status(500).send({
        success: false,
        error: 'Failed to update item',
      });
    }
  });

  // Delete item (DELETE /api/data/:projectSlug/:collectionSlug/:id)
  fastify.delete('/:projectSlug/:collectionSlug/:id', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
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
          error: 'Invalid project',
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
          error: 'Collection not found',
        });
      }

      // Build query
      const schema = collection.schema as unknown as CollectionSchema;
      const queryBuilder = new DynamicQueryBuilder(
        prisma,
        project.id,
        collectionSlug,
        schema
      );

      const deleted = await queryBuilder.delete(id);

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: 'Item not found',
        });
      }

      return reply.send({
        success: true,
        message: 'Item deleted successfully',
      });
    } catch (err) {
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: 'Failed to delete item',
      });
    }
  });
}
