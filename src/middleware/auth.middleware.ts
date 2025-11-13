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

// Middleware untuk check API key (untuk dynamic API)
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
