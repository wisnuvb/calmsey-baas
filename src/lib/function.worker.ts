import { parentPort, workerData } from "worker_threads";
import { PrismaClient } from "@prisma/client";

// This worker runs the user function code in a separate thread
// It creates its own Prisma connection to ensure isolation

if (!parentPort) {
  throw new Error("Worker must be spawned with parentPort");
}

parentPort.on("message", async (message) => {
  const { code, entrypoint, context, timeout } = message;
  const { projectId, projectSlug, env, request } = context;

  // Initialize isolated Prisma client for this execution
  // Ideally, we should pass the database URL from the main thread
  const prisma = new PrismaClient();

  const logs: string[] = [];

  const logFn = (...args: any[]) => {
    logs.push(`[LOG] ${args.map((a) => String(a)).join(" ")}`);
  };

  const errorFn = (...args: any[]) => {
    logs.push(`[ERROR] ${args.map((a) => String(a)).join(" ")}`);
  };

  const functionContext = {
    prisma,
    request,
    project: { id: projectId, slug: projectSlug },
    env,
    log: logFn,
    error: errorFn,
  };

  try {
    // Create a wrapper function
    // We use Function constructor instead of eval for slight better scope isolation
    // but in a Worker, the main threat is hanging the process, which Worker solves.

    const wrappedCode = `
      const module = { exports: {} };
      const exports = module.exports;

      ${code}

      if (typeof module.exports.${entrypoint} === 'function') {
        return module.exports.${entrypoint};
      } else if (typeof exports.${entrypoint} === 'function') {
        return exports.${entrypoint};
      } else {
        throw new Error('Entrypoint function "${entrypoint}" not found');
      }
    `;

    // Compile the function
    let fnImpl: any;
    try {
      fnImpl = new Function("context", "functionContext", wrappedCode);
    } catch (e: any) {
      await prisma.$disconnect();
      logs.push(`[DEBUG] Worker wrapper compile failed: ${e?.message}`);
      return parentPort?.postMessage({
        success: false,
        error: e?.message || "Wrapper compile error",
        errorStack: e?.stack,
        logs,
      });
    }

    // Execute
    // We get the entrypoint function back from the wrapper
    let entrypointFn: any;
    try {
      entrypointFn = fnImpl(functionContext, functionContext);
    } catch (e: any) {
      await prisma.$disconnect();
      logs.push(`[DEBUG] Wrapper execution failed: ${e?.message}`);
      return parentPort?.postMessage({
        success: false,
        error: e?.message || "Wrapper execution error",
        errorStack: e?.stack,
        logs,
      });
    }

    // Run the actual user function
    let result;
    if (typeof entrypointFn === "function") {
      result = await entrypointFn(functionContext);
    } else {
      throw new Error(`Entrypoint '${entrypoint}' is not a function`);
    }

    await prisma.$disconnect();

    parentPort?.postMessage({
      success: true,
      data: result,
      logs,
    });
  } catch (err: any) {
    await prisma.$disconnect();

    parentPort?.postMessage({
      success: false,
      error: err.message,
      errorStack: err.stack,
      logs,
    });
  }
});
