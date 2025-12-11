import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import { authRoutes } from "./routes/auth.routes";
import { projectRoutes } from "./routes/project.routes";
import { collectionRoutes } from "./routes/collection.routes";
import { dynamicApiRoutes } from "./routes/dynamic-api.routes";
import { uploadRoutes } from "./routes/upload.routes";
import { dashboardRoutes } from "./routes/dashboard.routes";
import { webhookRoutes } from "./routes/webhook.routes";
import { emailRoutes } from "./routes/email.routes";
import { functionRoutes } from "./routes/function.routes";
import { functionInvokeRoutes } from "./routes/function-invoke.routes";
import { registerRateLimit } from "./middleware/rate-limit.middleware";

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "0.0.0.0";

// Create Fastify instance
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === "production" ? "info" : "debug",
  },
});

// Register plugins
async function registerPlugins() {
  // CORS
  await fastify.register(cors, {
    origin: true, // Allow all origins in development
    credentials: true,
  });

  // Global error handler for JSON parsing errors
  fastify.setErrorHandler((error, request, reply) => {
    // Handle JSON parsing errors
    if (error instanceof SyntaxError || error.message?.includes("JSON")) {
      fastify.log.error({
        error: error.message,
        stack: error.stack,
        url: request.url,
        method: request.method,
      });

      return reply.status(400).send({
        success: false,
        error: "Invalid JSON format",
        details: {
          message: error.message || "Failed to parse request body",
          hint: "Check your JSON syntax. Numbers with leading zeros (e.g., 02384934) are invalid. Use strings or remove leading zeros.",
        },
      });
    }

    // Handle validation errors
    if (error.validation) {
      return reply.status(400).send({
        success: false,
        error: "Validation error",
        details: {
          message: "Request validation failed",
          errors: error.validation,
        },
      });
    }

    // Default error handler
    fastify.log.error(error);
    return reply.status(error.statusCode || 500).send({
      success: false,
      error: error.message || "Internal server error",
    });
  });

  // Swagger/OpenAPI Documentation
  await fastify.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "Calmsey BaaS API",
        description: "Backend as a Service API Documentation",
        version: "0.0.1",
        contact: {
          name: "Calmsey BaaS",
          email: "wisnuvb@gmail.com",
        },
      },
      servers: [
        {
          url: `http://localhost:${PORT}`,
          description: "Development server",
        },
        {
          url: process.env.API_URL || "https://api.calmsey.com",
          description: "Production server",
        },
      ],
      tags: [
        { name: "auth", description: "Authentication endpoints" },
        { name: "projects", description: "Project management" },
        { name: "collections", description: "Collection management" },
        { name: "data", description: "Dynamic data API" },
        { name: "upload", description: "File upload endpoints" },
        {
          name: "dashboard",
          description: "Dashboard statistics and aggregations",
        },
        { name: "webhooks", description: "Webhook management" },
        { name: "email", description: "Email service" },
        { name: "functions", description: "Serverless functions" },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
          },
          apiKeyAuth: {
            type: "apiKey",
            name: "X-API-Key",
            in: "header",
          },
        },
      },
    },
  });

  // Swagger UI
  await fastify.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: {
      docExpansion: "list",
      deepLinking: false,
    },
    uiHooks: {
      onRequest: function (request, reply, next) {
        next();
      },
      preHandler: function (request, reply, next) {
        next();
      },
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
    transformSpecification: (swaggerObject, request, reply) => {
      return swaggerObject;
    },
    transformSpecificationClone: true,
  });

  // Rate Limiting (register early, before other plugins)
  await registerRateLimit(fastify);

  // JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecretkey",
    sign: {
      expiresIn: process.env.JWT_EXPIRY || "24h", // Default 24 hours
    },
  });

  // Multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: parseInt(process.env.MAX_FILE_SIZE || "10485760"), // 10MB default
    },
  });
}

// Register routes
async function registerRoutes() {
  // Health check
  fastify.get("/health", async () => {
    return { status: "ok", timestamp: new Date().toISOString() };
  });

  // API routes
  await fastify.register(authRoutes, { prefix: "/api/auth" });
  await fastify.register(projectRoutes, { prefix: "/api/projects" });
  await fastify.register(collectionRoutes, { prefix: "/api/collections" });
  await fastify.register(uploadRoutes, { prefix: "/api/upload" });
  await fastify.register(webhookRoutes, { prefix: "/api" });
  await fastify.register(emailRoutes, { prefix: "/api" });
  await fastify.register(dashboardRoutes, { prefix: "/api/dashboard" });

  // Function routes
  await fastify.register(functionRoutes, { prefix: "/api/functions" });
  await fastify.register(functionInvokeRoutes, { prefix: "/api/invoke" });

  // Dynamic API routes (per project)
  await fastify.register(dynamicApiRoutes, { prefix: "/api/data" });
}

// Start server
async function start() {
  try {
    await registerPlugins();
    await registerRoutes();

    await fastify.listen({ port: PORT, host: HOST });

    console.log(`
    🚀 Calmsey BaaS Server is running!
    
    📍 URL: http://localhost:${PORT}
    🏥 Health: http://localhost:${PORT}/health
    📚 API Docs: http://localhost:${PORT}/docs
    📖 OpenAPI JSON: http://localhost:${PORT}/docs/json
    🌍 Environment: ${process.env.NODE_ENV || "development"}
    `);
  } catch (err) {
    fastify.log.error(err);
    await prisma.$disconnect();
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});

process.on("SIGTERM", async () => {
  console.log("\n🛑 Shutting down gracefully...");
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Start the server
start();
