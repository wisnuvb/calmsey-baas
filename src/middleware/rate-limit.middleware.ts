import { FastifyInstance, FastifyRequest } from "fastify";
import rateLimit from "@fastify/rate-limit";

export interface RateLimitOptions {
  max?: number;
  timeWindow?: string;
  keyGenerator?: (request: FastifyRequest) => string;
}

/**
 * Register rate limiting plugin
 */
export async function registerRateLimit(fastify: FastifyInstance) {
  // Default rate limit configuration
  const defaultMax = parseInt(process.env.RATE_LIMIT_MAX || "100");
  const defaultTimeWindow = process.env.RATE_LIMIT_TIME_WINDOW || "1 minute";

  await fastify.register(rateLimit, {
    max: defaultMax,
    timeWindow: defaultTimeWindow,
    // Use IP address as default key
    keyGenerator: (request: FastifyRequest) => {
      return (
        request.ip ||
        request.headers["x-forwarded-for"]?.toString() ||
        request.socket.remoteAddress ||
        "unknown"
      );
    },
    errorResponseBuilder: (request: FastifyRequest, context) => {
      return {
        success: false,
        error: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        limit: context.max,
        remaining: 0,
        reset: new Date(Date.now() + context.ttl),
      };
    },
    // Add rate limit headers
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  });
}

/**
 * Create rate limit configuration for specific routes
 */
export function createRateLimitConfig(options: RateLimitOptions = {}) {
  const max = options.max || parseInt(process.env.RATE_LIMIT_MAX || "100");
  const timeWindow =
    options.timeWindow || process.env.RATE_LIMIT_TIME_WINDOW || "1 minute";

  // Default keyGenerator menggunakan IP address jika tidak disediakan
  const defaultKeyGenerator = (request: FastifyRequest) => {
    return (
      request.ip ||
      request.headers["x-forwarded-for"]?.toString() ||
      request.socket.remoteAddress ||
      "unknown"
    );
  };

  return {
    max,
    timeWindow,
    keyGenerator: options.keyGenerator || defaultKeyGenerator,
    errorResponseBuilder: (request: FastifyRequest, context: any) => {
      return {
        success: false,
        error: "Rate limit exceeded",
        code: "RATE_LIMIT_EXCEEDED",
        limit: context.max,
        remaining: 0,
        reset: new Date(Date.now() + context.timeWindow),
      };
    },
    addHeaders: {
      "x-ratelimit-limit": true,
      "x-ratelimit-remaining": true,
      "x-ratelimit-reset": true,
    },
  };
}

/**
 * Rate limit by API key (for dynamic API routes)
 */
export function rateLimitByApiKey(request: FastifyRequest): string {
  const apiKey = request.headers["x-api-key"] as string;
  if (apiKey) {
    return `api-key:${apiKey}`;
  }
  // Fallback to IP if no API key
  return (
    request.ip ||
    request.headers["x-forwarded-for"]?.toString() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}

/**
 * Rate limit by user ID (for authenticated routes)
 */
export function rateLimitByUserId(request: FastifyRequest): string {
  const user = (request as any).user;
  if (user && user.id) {
    return `user:${user.id}`;
  }
  // Fallback to IP if no user
  return (
    request.ip ||
    request.headers["x-forwarded-for"]?.toString() ||
    request.socket.remoteAddress ||
    "unknown"
  );
}
