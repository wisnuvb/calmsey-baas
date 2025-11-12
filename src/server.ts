import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import multipart from "@fastify/multipart";
import dotenv from "dotenv";
import { prisma } from "./lib/prisma";
import { authRoutes } from "./routes/auth.routes";
import { projectRoutes } from "./routes/project.routes";
import { collectionRoutes } from "./routes/collection.routes";
import { dynamicApiRoutes } from "./routes/dynamic-api.routes";
import { uploadRoutes } from "./routes/upload.routes";

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

  // JWT
  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET || "supersecretkey",
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
    📚 Environment: ${process.env.NODE_ENV || "development"}
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
