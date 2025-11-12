import { FastifyInstance } from 'fastify';
import { authenticateApiKey } from '../middleware/auth.middleware';
import { FileUploadService } from '../lib/file-upload.service';
import { prisma } from '../lib/prisma';

export async function uploadRoutes(fastify: FastifyInstance) {
  /**
   * Upload file
   * POST /api/upload/:projectSlug
   * Requires X-API-Key header
   */
  fastify.post('/:projectSlug', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
    try {
      const { projectSlug } = request.params as { projectSlug: string };
      const project = (request as any).project;

      // Verify project slug
      if (project.slug !== projectSlug) {
        return reply.status(403).send({
          success: false,
          error: 'Invalid project',
        });
      }

      // Get project settings
      const settings = await prisma.projectSettings.findUnique({
        where: { projectId: project.id },
      });

      // Get file from multipart
      const data = await request.file();

      if (!data) {
        return reply.status(400).send({
          success: false,
          error: 'No file provided',
        });
      }

      // Create upload service based on project settings
      const uploadService = new FileUploadService({
        storageType: (settings?.storageType as 'local' | 's3') || 'local',
        uploadDir: process.env.UPLOAD_DIR,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
      });

      // Upload file
      const result = await uploadService.upload(data);

      return reply.send({
        success: true,
        data: result,
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to upload file',
      });
    }
  });

  /**
   * Upload multiple files
   * POST /api/upload/:projectSlug/multiple
   * Requires X-API-Key header
   */
  fastify.post('/:projectSlug/multiple', {
    onRequest: [authenticateApiKey],
  }, async (request, reply) => {
    try {
      const { projectSlug } = request.params as { projectSlug: string };
      const project = (request as any).project;

      // Verify project slug
      if (project.slug !== projectSlug) {
        return reply.status(403).send({
          success: false,
          error: 'Invalid project',
        });
      }

      // Get project settings
      const settings = await prisma.projectSettings.findUnique({
        where: { projectId: project.id },
      });

      // Create upload service
      const uploadService = new FileUploadService({
        storageType: (settings?.storageType as 'local' | 's3') || 'local',
        uploadDir: process.env.UPLOAD_DIR,
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '10485760'),
      });

      // Get all files
      const files = await request.files();
      const results = [];
      const errors = [];

      for await (const file of files) {
        try {
          const result = await uploadService.upload(file);
          results.push(result);
        } catch (err: any) {
          errors.push({
            filename: file.filename,
            error: err.message,
          });
        }
      }

      return reply.send({
        success: true,
        data: {
          uploaded: results,
          errors,
        },
      });
    } catch (err: any) {
      fastify.log.error(err);
      return reply.status(500).send({
        success: false,
        error: err.message || 'Failed to upload files',
      });
    }
  });
}
