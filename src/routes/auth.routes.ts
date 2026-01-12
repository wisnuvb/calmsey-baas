import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { authenticate } from "../middleware/auth.middleware";
import {
  createRateLimitConfig,
  rateLimitByUserId,
} from "../middleware/rate-limit.middleware";

// Validation schemas
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

export async function authRoutes(fastify: FastifyInstance) {
  // Rate limit config untuk auth endpoints (lebih strict)
  const authRateLimit = createRateLimitConfig({
    max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || "10"), // 10 requests
    timeWindow: process.env.AUTH_RATE_LIMIT_WINDOW || "15 minutes",
  });

  // Register new user
  fastify.post(
    "/register",
    {
      config: {
        rateLimit: authRateLimit,
      },
      schema: {
        tags: ["auth"],
        summary: "Register new user",
        description: "Create a new user account",
        body: {
          type: "object",
          required: ["email", "password", "name"],
          properties: {
            email: {
              type: "string",
              format: "email",
            },
            password: {
              type: "string",
              format: "password",
              minLength: 8,
            },
            name: {
              type: "string",
            },
          },
        },
        response: {
          201: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  user: { type: "object" },
                  token: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const body = registerSchema.parse(request.body);

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (existingUser) {
          return reply.status(400).send({
            success: false,
            error: "User with this email already exists",
          });
        }

        // Hash password
        const hashedPassword = await hashPassword(body.password);

        // Create user
        const user = await prisma.user.create({
          data: {
            email: body.email,
            password: hashedPassword,
            name: body.name,
          },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

        // Generate JWT token with expiry
        const jwtExpiry = process.env.JWT_EXPIRY || "24h";
        const token = fastify.jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          {
            expiresIn: jwtExpiry,
          }
        );

        return reply.status(201).send({
          success: true,
          data: {
            user,
            token,
            expiresIn: jwtExpiry, // Add this
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

        return reply.status(500).send({
          success: false,
          error: "Failed to register user",
        });
      }
    }
  );

  // Login
  fastify.post(
    "/login",
    {
      config: {
        rateLimit: authRateLimit,
      },
      schema: {
        tags: ["auth"],
        summary: "Login user",
        description: "Authenticate user and get JWT token",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
            },
            password: {
              type: "string",
              format: "password",
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
                  user: { type: "object" },
                  token: { type: "string" },
                },
              },
            },
          },
          401: {
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
        const body = loginSchema.parse(request.body);

        // Find user
        const user = await prisma.user.findUnique({
          where: { email: body.email },
        });

        if (!user) {
          return reply.status(401).send({
            success: false,
            error: "Invalid credentials",
          });
        }

        // Verify password
        const isValid = await verifyPassword(
          body.password,
          user.password || ""
        );

        if (!isValid) {
          return reply.status(401).send({
            success: false,
            error: "Invalid credentials",
          });
        }

        // Generate JWT token with expiry
        const jwtExpiry = process.env.JWT_EXPIRY || "24h";
        const token = fastify.jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: user.role,
          },
          {
            expiresIn: jwtExpiry,
          }
        );

        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
            },
            token,
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

        return reply.status(500).send({
          success: false,
          error: "Failed to login",
        });
      }
    }
  );

  // Google OAuth Login
  fastify.post(
    "/oauth/google",
    {
      config: {
        rateLimit: authRateLimit,
      },
      schema: {
        tags: ["auth"],
        summary: "Login with Google",
        body: {
          type: "object",
          required: ["idToken"],
          properties: {
            idToken: { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const { idToken } = request.body as { idToken: string };

        // MOCK VERIFICATION for now
        // In production, use google-auth-library:
        // const ticket = await client.verifyIdToken({ idToken, audience: CLIENT_ID });
        // const payload = ticket.getPayload();

        // Simulating Google payload decoding (unsafe, just for dev structure)
        // Ideally we assume idToken is valid and contains email/sub for this MVP step
        // OR we just use a dummy payload if idToken is "test-token"

        let payload: any = {};

        if (idToken === "test-token") {
          payload = {
            email: "test-google@example.com",
            name: "Test Google User",
            sub: "google-123456",
            picture: "https://example.com/avatar.jpg",
          };
        } else {
          // Try to decode JWT without verify just to get email (for POC only!)
          // WARN: THIS IS NOT SECURE FOR PRODUCTION
          const parts = idToken.split(".");
          if (parts.length === 3) {
            payload = JSON.parse(Buffer.from(parts[1], "base64").toString());
          } else {
            throw new Error("Invalid token format");
          }
        }

        if (!payload.email || !payload.sub) {
          return reply
            .status(400)
            .send({ success: false, error: "Invalid token payload" });
        }

        const email = payload.email;
        const googleId = payload.sub;
        const name = payload.name;
        const picture = payload.picture;

        // Check if user exists
        let user = await prisma.user.findUnique({
          where: { email },
          include: { accounts: true },
        });

        if (!user) {
          // Create new user
          user = await prisma.user.create({
            data: {
              email,
              name,
              avatarUrl: picture,
              role: "USER",
              accounts: {
                create: {
                  provider: "google",
                  providerAccountId: googleId,
                  // type: "oauth",
                },
              },
            },
            include: { accounts: true },
          });
        } else {
          // Check if account link exists
          const accountExists = user.accounts.some(
            (acc) =>
              acc.provider === "google" && acc.providerAccountId === googleId
          );
          if (!accountExists) {
            // Link account
            await prisma.account.create({
              data: {
                userId: user.id,
                provider: "google",
                providerAccountId: googleId,
              },
            });
          }
        }

        // Generate App JWT
        const token = fastify.jwt.sign({
          id: user.id,
          email: user.email,
          role: user.role,
        });

        return reply.send({
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              role: user.role,
              avatarUrl: user.avatarUrl,
            },
            token,
          },
        });
      } catch (err: any) {
        return reply.status(500).send({
          success: false,
          error: "OAuth login failed: " + err.message,
        });
      }
    }
  );

  // Get current user (protected route)
  fastify.get(
    "/me",
    {
      onRequest: [authenticate],
      config: {
        rateLimit: createRateLimitConfig({
          max: parseInt(process.env.USER_RATE_LIMIT_MAX || "100"),
          timeWindow: process.env.USER_RATE_LIMIT_WINDOW || "1 minute",
          keyGenerator: rateLimitByUserId,
        }),
      },
      schema: {
        tags: ["auth"],
        summary: "Get current user",
        description: "Retrieve the current authenticated user's details",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  name: { type: "string" },
                  role: { type: "string" },
                  createdAt: { type: "string", format: "date-time" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = await prisma.user.findUnique({
          where: { id: (request.user as any).id },
          select: {
            id: true,
            email: true,
            name: true,
            role: true,
            createdAt: true,
          },
        });

        return reply.send({
          success: true,
          data: user,
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to get user",
        });
      }
    }
  );

  // Refresh token (protected route)
  fastify.post(
    "/refresh",
    {
      onRequest: [authenticate],
      schema: {
        tags: ["auth"],
        summary: "Refresh JWT token",
        description: "Generate a new JWT token for the authenticated user",
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  token: { type: "string" },
                  expiresIn: { type: "string" },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      try {
        const user = request.user as any;

        // Verify user still exists
        const existingUser = await prisma.user.findUnique({
          where: { id: user.id },
        });

        if (!existingUser) {
          return reply.status(401).send({
            success: false,
            error: "User not found",
          });
        }

        // Generate new JWT token
        const jwtExpiry = process.env.JWT_EXPIRY || "24h";
        const token = fastify.jwt.sign(
          {
            id: existingUser.id,
            email: existingUser.email,
            role: existingUser.role,
          },
          {
            expiresIn: jwtExpiry,
          }
        );

        return reply.send({
          success: true,
          data: {
            token,
            expiresIn: jwtExpiry,
          },
        });
      } catch (err) {
        return reply.status(500).send({
          success: false,
          error: "Failed to refresh token",
        });
      }
    }
  );
}
