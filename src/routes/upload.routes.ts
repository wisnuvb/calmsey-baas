import { FastifyInstance } from "fastify";
import { authenticateApiKey } from "../middleware/auth.middleware";
import { FileUploadService } from "../lib/file-upload.service";
import { prisma } from "../lib/prisma";

export async function uploadRoutes(fastify: FastifyInstance) {
  /**
   * Upload file
   * POST /api/upload/:projectSlug
   * Requires X-API-Key header
   */
  fastify.post(
    "/:projectSlug",
    {
      onRequest: [authenticateApiKey],
    },
    async (request, reply) => {
      try {
        const { projectSlug } = request.params as { projectSlug: string };
        const project = (request as any).project;

        // Verify project slug
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
          where: { projectId: project.id },
        });

        const storageType =
          (settings?.storageType as "local" | "s3") || "local";

        // Parse S3 config from settings or environment
        let s3Config: any = undefined;
        if (storageType === "s3") {
          const storageConfig = settings?.storageConfig as any;
          s3Config = {
            region: storageConfig?.region || process.env.AWS_REGION,
            accessKeyId:
              storageConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey:
              storageConfig?.secretAccessKey ||
              process.env.AWS_SECRET_ACCESS_KEY,
            bucketName:
              storageConfig?.bucketName || process.env.AWS_BUCKET_NAME,
            endpoint: storageConfig?.endpoint,
            pathPrefix: storageConfig?.pathPrefix || `project-${project.id}/`,
            publicUrl: storageConfig?.publicUrl,
          };
        }

        // Get file from multipart
        const data = await request.file();

        if (!data) {
          return reply.status(400).send({
            success: false,
            error: "No file provided",
          });
        }

        // Create upload service based on project settings
        const uploadService = new FileUploadService({
          storageType,
          uploadDir: process.env.UPLOAD_DIR,
          maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
          s3Config,
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
          error: err.message || "Failed to upload file",
        });
      }
    }
  );

  /**
   * Upload multiple files
   * POST /api/upload/:projectSlug/multiple
   * Requires X-API-Key header
   */
  fastify.post(
    "/:projectSlug/multiple",
    {
      onRequest: [authenticateApiKey],
    },
    async (request, reply) => {
      try {
        const { projectSlug } = request.params as { projectSlug: string };
        const project = (request as any).project;

        // Verify project slug
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
          where: { projectId: project.id },
        });

        const storageType =
          (settings?.storageType as "local" | "s3") || "local";

        // Parse S3 config
        let s3Config: any = undefined;
        if (storageType === "s3") {
          const storageConfig = settings?.storageConfig as any;
          s3Config = {
            region: storageConfig?.region || process.env.AWS_REGION,
            accessKeyId:
              storageConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey:
              storageConfig?.secretAccessKey ||
              process.env.AWS_SECRET_ACCESS_KEY,
            bucketName:
              storageConfig?.bucketName || process.env.AWS_BUCKET_NAME,
            endpoint: storageConfig?.endpoint,
            pathPrefix: storageConfig?.pathPrefix || `project-${project.id}/`,
            publicUrl: storageConfig?.publicUrl,
          };
        }

        // Create upload service
        const uploadService = new FileUploadService({
          storageType,
          uploadDir: process.env.UPLOAD_DIR,
          maxFileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"),
          s3Config,
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
          error: err.message || "Failed to upload files",
        });
      }
    }
  );

  /**
   * Delete file
   * DELETE /api/upload/:projectSlug/:filepath
   * Requires X-API-Key header
   */
  fastify.delete(
    "/:projectSlug/:filepath*",
    {
      onRequest: [authenticateApiKey],
    },
    async (request, reply) => {
      try {
        const { projectSlug, filepath } = request.params as {
          projectSlug: string;
          filepath: string;
        };
        const project = (request as any).project;

        // Verify project slug
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
          where: { projectId: project.id },
        });

        const storageType =
          (settings?.storageType as "local" | "s3") || "local";

        // Parse S3 config
        let s3Config: any = undefined;
        if (storageType === "s3") {
          const storageConfig = settings?.storageConfig as any;
          s3Config = {
            region: storageConfig?.region || process.env.AWS_REGION,
            accessKeyId:
              storageConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey:
              storageConfig?.secretAccessKey ||
              process.env.AWS_SECRET_ACCESS_KEY,
            bucketName:
              storageConfig?.bucketName || process.env.AWS_BUCKET_NAME,
            endpoint: storageConfig?.endpoint,
            pathPrefix: storageConfig?.pathPrefix || `project-${project.id}/`,
          };
        }

        // Create upload service
        const uploadService = new FileUploadService({
          storageType,
          uploadDir: process.env.UPLOAD_DIR,
          s3Config,
        });

        // Delete file
        const deleted = await uploadService.delete(filepath);

        if (!deleted) {
          return reply.status(404).send({
            success: false,
            error: "File not found or failed to delete",
          });
        }

        return reply.send({
          success: true,
          message: "File deleted successfully",
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to delete file",
        });
      }
    }
  );

  /**
   * Get presigned URL (for S3)
   * GET /api/upload/:projectSlug/presigned/:filepath
   * Requires X-API-Key header
   */
  fastify.get(
    "/:projectSlug/presigned/:filepath*",
    {
      onRequest: [authenticateApiKey],
    },
    async (request, reply) => {
      try {
        const { projectSlug, filepath } = request.params as {
          projectSlug: string;
          filepath: string;
        };
        const project = (request as any).project;

        // Verify project slug
        if (project.slug !== projectSlug) {
          return reply.status(403).send({
            success: false,
            error: "Invalid project",
          });
        }

        // Get project settings
        const settings = await prisma.projectSettings.findUnique({
          where: { projectId: project.id },
        });

        const storageType =
          (settings?.storageType as "local" | "s3") || "local";

        if (storageType !== "s3") {
          return reply.status(400).send({
            success: false,
            error: "Presigned URLs are only available for S3 storage",
          });
        }

        // Parse S3 config
        const storageConfig = settings?.storageConfig as any;
        const s3Config = {
          region: storageConfig?.region || process.env.AWS_REGION,
          accessKeyId:
            storageConfig?.accessKeyId || process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey:
            storageConfig?.secretAccessKey || process.env.AWS_SECRET_ACCESS_KEY,
          bucketName: storageConfig?.bucketName || process.env.AWS_BUCKET_NAME,
          endpoint: storageConfig?.endpoint,
          pathPrefix: storageConfig?.pathPrefix || `project-${project.id}/`,
        };

        // Create upload service
        const uploadService = new FileUploadService({
          storageType: "s3",
          s3Config,
        });

        // Get expiresIn from query (default 1 hour)
        const expiresIn = parseInt((request.query as any)?.expiresIn || "3600");

        // Generate presigned URL
        const presignedUrl = await uploadService.getPresignedUrl(
          filepath,
          expiresIn
        );

        return reply.send({
          success: true,
          data: {
            url: presignedUrl,
            expiresIn,
            expiresAt: new Date(Date.now() + expiresIn * 1000).toISOString(),
          },
        });
      } catch (err: any) {
        fastify.log.error(err);
        return reply.status(500).send({
          success: false,
          error: err.message || "Failed to generate presigned URL",
        });
      }
    }
  );
}
