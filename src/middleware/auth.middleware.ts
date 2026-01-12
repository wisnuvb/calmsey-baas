import { FastifyReply, FastifyRequest } from "fastify";
import { AuthenticatedRequest } from "../types";

export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    await request.jwtVerify();
    // JWT payload will be available in request.user
  } catch (err: any) {
    // Handle different JWT errors
    if (err.code === "FST_JWT_AUTHORIZATION_TOKEN_EXPIRED") {
      return reply.status(401).send({
        success: false,
        error: "Token expired",
        code: "TOKEN_EXPIRED",
      });
    }

    if (err.code === "FST_JWT_AUTHORIZATION_TOKEN_INVALID") {
      return reply.status(401).send({
        success: false,
        error: "Invalid token",
        code: "TOKEN_INVALID",
      });
    }

    if (err.code === "FST_JWT_NO_AUTHORIZATION_IN_HEADER") {
      return reply.status(401).send({
        success: false,
        error: "No authorization token provided",
        code: "TOKEN_MISSING",
      });
    }

    // Generic error
    return reply.status(401).send({
      success: false,
      error: "Unauthorized - Invalid or missing token",
      code: "UNAUTHORIZED",
    });
  }
}

// New middleware for Dynamic API (RBAC support)
// Supports: API Key (Admin) OR JWT (User) OR Public (Guest)
export async function authenticateDynamicRequest(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers["x-api-key"] as string;
  const { prisma } = await import("../lib/prisma");
  const params = request.params as { projectSlug?: string };

  // 1. Priority: API Key (Admin Access)
  if (apiKey) {
    try {
      const key = await prisma.apiKey.findUnique({
        where: { key: apiKey },
        include: { project: true },
      });

      if (key) {
        // Valid Admin Key
        await prisma.apiKey.update({
          where: { id: key.id },
          data: { lastUsed: new Date() },
        });

        (request as any).project = key.project;
        (request as any).apiKey = key;
        (request as any).accessContext = { role: "admin" }; // System role
        return; // Proceed
      } else {
        return reply
          .status(401)
          .send({ success: false, error: "Invalid API key" });
      }
    } catch (err) {
      return reply
        .status(500)
        .send({ success: false, error: "Auth Check Failed" });
    }
  }

  // 2. Fallback: Project Slug + JWT/Public
  // We need to resolve project from URL first because there is no API Key
  if (!params.projectSlug) {
    // Should not happen if route defined correctly
    return reply
      .status(400)
      .send({ success: false, error: "Project context missing" });
  }

  const project = await prisma.project.findUnique({
    where: { slug: params.projectSlug },
  });

  if (!project) {
    return reply
      .status(404)
      .send({ success: false, error: "Project not found" });
  }

  (request as any).project = project;

  // Check JWT
  try {
    await request.jwtVerify();
    // Valid JWT
    const user = (request as any).user;
    (request as any).accessContext = {
      role: "authenticated",
      userId: user.id || user.sub, // Match with JWT payload
      // Get dynamic role from JWT. Priorities: user.role -> user.app_metadata.role -> "authenticated"
      userRole:
        user.role ||
        (user.app_metadata && user.app_metadata.role) ||
        "authenticated",
    };
  } catch (err) {
    // No valid token -> Public Guest
    (request as any).accessContext = { role: "public" };
  }
}

// Middleware Legacy (can be removed later if all routes migrate to the new one)
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
) {
  const apiKey = request.headers["x-api-key"] as string;

  if (!apiKey) {
    return reply.status(401).send({
      success: false,
      error: "API key is required",
    });
  }

  try {
    const { prisma } = await import("../lib/prisma");

    const key = await prisma.apiKey.findUnique({
      where: { key: apiKey },
      include: { project: true },
    });

    if (!key) {
      return reply.status(401).send({
        success: false,
        error: "Invalid API key",
      });
    }

    // Update last used timestamp
    await prisma.apiKey.update({
      where: { id: key.id },
      data: { lastUsed: new Date() },
    });

    // Attach project info to request
    (request as any).project = key.project;
    (request as any).apiKey = key;
  } catch (err) {
    return reply.status(500).send({
      success: false,
      error: "Authentication failed",
    });
  }
}

// Check if user is admin
export async function requireAdmin(
  request: AuthenticatedRequest,
  reply: FastifyReply
) {
  if (request.user.role !== "ADMIN") {
    return reply.status(403).send({
      success: false,
      error: "Forbidden - Admin access required",
    });
  }
}
