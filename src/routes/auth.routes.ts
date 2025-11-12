import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { hashPassword, verifyPassword } from "../lib/password";
import { authenticate } from "../middleware/auth.middleware";

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
  // Register new user
  fastify.post("/register", async (request, reply) => {
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

      // Generate JWT token
      const token = fastify.jwt.sign({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      return reply.status(201).send({
        success: true,
        data: {
          user,
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
        error: "Failed to register user",
      });
    }
  });

  // Login
  fastify.post("/login", async (request, reply) => {
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
      const isValid = await verifyPassword(body.password, user.password);

      if (!isValid) {
        return reply.status(401).send({
          success: false,
          error: "Invalid credentials",
        });
      }

      // Generate JWT token
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
  });

  // Get current user (protected route)
  fastify.get(
    "/me",
    {
      onRequest: [authenticate],
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
}
