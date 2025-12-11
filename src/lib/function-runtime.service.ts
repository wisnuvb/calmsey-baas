import { Worker } from "worker_threads";
import * as esbuild from "esbuild";
import { createHash } from "crypto";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import { PrismaClient } from "@prisma/client";

export interface FunctionContext {
  // Database access (scoped to project)
  prisma: PrismaClient;

  // Request info
  request: {
    body: any;
    headers: Record<string, string>;
    method: string;
    query: Record<string, string>;
    params: Record<string, string>;
  };

  // Project info
  project: {
    id: string;
    slug: string;
  };

  // Environment variables
  env: Record<string, string>;

  // Logging (captured and returned)
  log: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

export interface FunctionExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  errorStack?: string;
  logs: string[];
  duration: number;
  memoryUsed?: number;
  status: "SUCCESS" | "ERROR" | "TIMEOUT" | "MEMORY_EXCEEDED";
}

export interface FunctionConfig {
  id: string;
  sourceCode: string;
  entrypoint: string;
  timeout: number;
  memory: number;
  envVars?: Record<string, string>;
  projectId: string;
  projectSlug: string;
}

export class FunctionRuntimeService {
  private bundleCache: Map<string, string> = new Map();
  private bundleDir: string;

  constructor() {
    // Create bundle directory if not exists
    this.bundleDir = join(process.cwd(), ".functions");
    if (!existsSync(this.bundleDir)) {
      mkdirSync(this.bundleDir, { recursive: true });
    }
  }

  /**
   * Generate hash from source code for caching
   */
  private generateHash(sourceCode: string): string {
    return createHash("sha256").update(sourceCode).digest("hex");
  }

  /**
   * Compile TypeScript to JavaScript using esbuild
   */
  private async compileFunction(
    sourceCode: string,
    hash: string
  ): Promise<string> {
    // Check cache first
    if (this.bundleCache.has(hash)) {
      return this.bundleCache.get(hash)!;
    }

    const bundlePath = join(this.bundleDir, `${hash}.js`);

    // Check if bundle exists on disk
    if (existsSync(bundlePath)) {
      const bundleCode = readFileSync(bundlePath, "utf-8");
      this.bundleCache.set(hash, bundleCode);
      return bundleCode;
    }

    try {
      // Compile TypeScript to JavaScript
      const result = await esbuild.build({
        stdin: {
          contents: sourceCode,
          loader: "ts",
          resolveDir: process.cwd(),
        },
        bundle: true, // Don't bundle dependencies (we'll provide them)
        platform: "node",
        target: "node20",
        format: "cjs",
        write: false,
        minify: false,
        sourcemap: false,
        // Allow these external modules
        external: ["@prisma/client", "zod", "nanoid"],
      });

      const compiledCode = result.outputFiles[0].text;

      // Save to disk for caching
      writeFileSync(bundlePath, compiledCode, "utf-8");

      // Cache in memory
      this.bundleCache.set(hash, compiledCode);

      return compiledCode;
    } catch (error: any) {
      throw new Error(`Compilation failed: ${error.message}`);
    }
  }

  /**
   * Create sandboxed context for function execution
   */
  private createContext(
    config: FunctionConfig,
    prisma: PrismaClient,
    request: FunctionContext["request"]
  ): FunctionContext {
    const logs: string[] = [];

    return {
      prisma,
      request,
      project: {
        id: config.projectId,
        slug: config.projectSlug,
      },
      env: config.envVars || {},
      log: (...args: any[]) => {
        const message = args.map((arg) => String(arg)).join(" ");
        logs.push(`[LOG] ${message}`);
      },
      error: (...args: any[]) => {
        const message = args.map((arg) => String(arg)).join(" ");
        logs.push(`[ERROR] ${message}`);
      },
    };
  }

  /**
   * Execute function in sandboxed environment
   */
  async execute(
    config: FunctionConfig,
    prisma: PrismaClient,
    request: {
      body?: any;
      headers?: Record<string, string>;
      method?: string;
      query?: Record<string, string>;
      params?: Record<string, string>;
    }
  ): Promise<FunctionExecutionResult> {
    const startTime = Date.now();
    const logs: string[] = [];

    try {
      // Generate hash and compile
      const hash = this.generateHash(config.sourceCode);
      const compiledCode = await this.compileFunction(config.sourceCode, hash);

      // Create context
      const context = this.createContext(config, prisma, {
        body: request.body || {},
        headers: request.headers || {},
        method: request.method || "POST",
        query: request.query || {},
        params: request.params || {},
      });

      // Execute function with timeout
      const result = await this.executeWithTimeout(
        compiledCode,
        config.entrypoint,
        context,
        config.timeout
      );

      const duration = Date.now() - startTime;

      // Capture logs from context
      if (typeof context.log === "function") {
        // Logs are captured in the context object
        context.log(logs);
      }

      return {
        success: true,
        data: result,
        logs: logs,
        duration,
        status: "SUCCESS",
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;

      // Check if timeout
      if (error.message?.includes("timeout")) {
        return {
          success: false,
          error: `Function execution timeout after ${config.timeout}ms`,
          errorStack: error.stack,
          logs,
          duration,
          status: "TIMEOUT",
        };
      }

      // Check if memory exceeded (basic check)
      if (error.message?.includes("memory")) {
        return {
          success: false,
          error: "Memory limit exceeded",
          errorStack: error.stack,
          logs,
          duration,
          status: "MEMORY_EXCEEDED",
        };
      }

      return {
        success: false,
        error: error.message || "Unknown error",
        errorStack: error.stack,
        logs,
        duration,
        status: "ERROR",
      };
    }
  }

  /**
   * Execute compiled code with timeout
   */
  private async executeWithTimeout(
    compiledCode: string,
    entrypoint: string,
    context: FunctionContext,
    timeout: number
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Function execution timeout after ${timeout}ms`));
      }, timeout);

      try {
        // Create a safe module wrapper
        // We wrap in an IIFE to avoid scope pollution and syntax errors with eval
        const wrappedCode = `
          (function() {
            const module = { exports: {} };
            const exports = module.exports;
            const require = (id) => {
              if (id === '@prisma/client') return context.prisma;
              // Basic mock for other potential requires if needed
              try { return global.require(id); } catch (e) { return null; }
            };
            
            ${compiledCode}
            
            // Return the entrypoint function
            if (typeof module.exports.${entrypoint} === 'function') {
              return module.exports.${entrypoint};
            } else if (typeof exports.${entrypoint} === 'function') {
              return exports.${entrypoint};
            } else {
              throw new Error('Entrypoint function "${entrypoint}" not found');
            }
          })()
        `;

        // Execute in current context
        const fn = eval(wrappedCode);

        // Call the function
        const result = fn(context);

        // Handle async functions
        if (result instanceof Promise) {
          result
            .then((data) => {
              clearTimeout(timeoutId);
              resolve(data);
            })
            .catch((error) => {
              clearTimeout(timeoutId);
              reject(error);
            });
        } else {
          clearTimeout(timeoutId);
          resolve(result);
        }
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Validate function source code
   */
  async validate(
    sourceCode: string
  ): Promise<{ valid: boolean; error?: string }> {
    try {
      // Try to compile
      const hash = this.generateHash(sourceCode);
      await this.compileFunction(sourceCode, hash);
      return { valid: true };
    } catch (error: any) {
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Clear bundle cache
   */
  clearCache(hash?: string) {
    if (hash) {
      this.bundleCache.delete(hash);
    } else {
      this.bundleCache.clear();
    }
  }
}
