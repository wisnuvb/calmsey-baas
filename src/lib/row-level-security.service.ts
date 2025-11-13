import { PrismaClient } from "@prisma/client";

/**
 * Row-Level Security (RLS) Service
 * Implements database-level security policies for multi-tenant isolation
 */
export class RowLevelSecurityService {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Enable Row-Level Security on a table (PostgreSQL only)
   */
  async enableRLS(tableName: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "${tableName}" ENABLE ROW LEVEL SECURITY;
      `);
    } catch (error: any) {
      console.error(`[RLS] Failed to enable RLS on ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Disable Row-Level Security on a table
   */
  async disableRLS(tableName: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        ALTER TABLE "${tableName}" DISABLE ROW LEVEL SECURITY;
      `);
    } catch (error: any) {
      console.error(`[RLS] Failed to disable RLS on ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Create RLS policy for project isolation
   * Ensures users can only access data from their own project
   */
  async createProjectIsolationPolicy(
    tableName: string,
    projectIdColumn: string = "project_id"
  ): Promise<void> {
    const policyName = `${tableName}_project_isolation`;

    try {
      // Drop existing policy if exists
      await this.prisma.$executeRawUnsafe(`
        DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";
      `);

      // Create new policy
      // This assumes you have a way to set current_project_id in session
      await this.prisma.$executeRawUnsafe(`
        CREATE POLICY "${policyName}" ON "${tableName}"
        USING ("${projectIdColumn}" = current_setting('app.current_project_id', true)::text);
      `);

      console.log(`[RLS] Created project isolation policy on ${tableName}`);
    } catch (error: any) {
      console.error(`[RLS] Failed to create policy on ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Create RLS policy for user-based access
   */
  async createUserAccessPolicy(
    tableName: string,
    userIdColumn: string = "user_id"
  ): Promise<void> {
    const policyName = `${tableName}_user_access`;

    try {
      await this.prisma.$executeRawUnsafe(`
        DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE POLICY "${policyName}" ON "${tableName}"
        USING ("${userIdColumn}" = current_setting('app.current_user_id', true)::text);
      `);

      console.log(`[RLS] Created user access policy on ${tableName}`);
    } catch (error: any) {
      console.error(`[RLS] Failed to create user policy on ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Create RLS policy with custom condition
   */
  async createCustomPolicy(
    tableName: string,
    policyName: string,
    condition: string,
    command?: "SELECT" | "INSERT" | "UPDATE" | "DELETE" | "ALL"
  ): Promise<void> {
    try {
      const commandClause = command ? `FOR ${command}` : "";

      await this.prisma.$executeRawUnsafe(`
        DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";
      `);

      await this.prisma.$executeRawUnsafe(`
        CREATE POLICY "${policyName}" ON "${tableName}"
        ${commandClause}
        USING (${condition});
      `);

      console.log(`[RLS] Created custom policy '${policyName}' on ${tableName}`);
    } catch (error: any) {
      console.error(`[RLS] Failed to create custom policy:`, error.message);
      throw error;
    }
  }

  /**
   * Drop RLS policy
   */
  async dropPolicy(tableName: string, policyName: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        DROP POLICY IF EXISTS "${policyName}" ON "${tableName}";
      `);
    } catch (error: any) {
      console.error(`[RLS] Failed to drop policy:`, error.message);
      throw error;
    }
  }

  /**
   * Set current project ID in session (PostgreSQL)
   * This is used by RLS policies to filter data
   */
  async setProjectContext(projectId: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        SET LOCAL app.current_project_id = '${projectId}';
      `);
    } catch (error: any) {
      console.error(`[RLS] Failed to set project context:`, error.message);
      throw error;
    }
  }

  /**
   * Set current user ID in session (PostgreSQL)
   */
  async setUserContext(userId: string): Promise<void> {
    try {
      await this.prisma.$executeRawUnsafe(`
        SET LOCAL app.current_user_id = '${userId}';
      `);
    } catch (error: any) {
      console.error(`[RLS] Failed to set user context:`, error.message);
      throw error;
    }
  }

  /**
   * Execute query with RLS context
   * Automatically sets project/user context before executing query
   */
  async executeWithContext<T>(
    context: { projectId?: string; userId?: string },
    callback: () => Promise<T>
  ): Promise<T> {
    return await this.prisma.$transaction(async (tx) => {
      // Set context
      if (context.projectId) {
        await (tx as any).$executeRawUnsafe(`
          SET LOCAL app.current_project_id = '${context.projectId}';
        `);
      }

      if (context.userId) {
        await (tx as any).$executeRawUnsafe(`
          SET LOCAL app.current_user_id = '${context.userId}';
        `);
      }

      // Execute callback with context set
      return await callback();
    });
  }

  /**
   * Check if RLS is enabled on a table
   */
  async isRLSEnabled(tableName: string): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe(`
        SELECT relrowsecurity
        FROM pg_class
        WHERE relname = '${tableName}';
      `) as any[];

      return result.length > 0 && result[0].relrowsecurity;
    } catch (error) {
      return false;
    }
  }

  /**
   * List all policies on a table
   */
  async listPolicies(tableName: string): Promise<any[]> {
    try {
      const policies = await this.prisma.$queryRawUnsafe(`
        SELECT
          polname as name,
          polcmd as command,
          pg_get_expr(polqual, polrelid) as condition
        FROM pg_policy
        WHERE polrelid = '${tableName}'::regclass;
      `) as any[];

      return policies;
    } catch (error) {
      return [];
    }
  }

  /**
   * Initialize RLS for all dynamic tables in a project
   * Call this when creating collections to auto-enable RLS
   */
  async initializeProjectRLS(projectId: string): Promise<void> {
    // Get all collections for this project
    const collections = await this.prisma.collection.findMany({
      where: { projectId },
    });

    for (const collection of collections) {
      const tableName = `data_${projectId.replace(/-/g, "_")}_${collection.slug}`;

      try {
        // Enable RLS
        await this.enableRLS(tableName);

        // Create project isolation policy
        // Note: You would need to add a project_id column to dynamic tables
        // Or use table name pattern matching for isolation
        console.log(`[RLS] Initialized RLS for table ${tableName}`);
      } catch (error) {
        console.error(`[RLS] Failed to initialize RLS for ${tableName}:`, error);
      }
    }
  }

  /**
   * Application-level RLS (works for MySQL and PostgreSQL)
   * Adds WHERE clause to filter by project/user
   */
  applyApplicationRLS(
    baseWhere: string,
    context: { projectId?: string; userId?: string }
  ): string {
    const conditions: string[] = [];

    if (baseWhere && baseWhere !== "WHERE 1=1") {
      conditions.push(baseWhere.replace("WHERE ", ""));
    }

    // Note: This assumes your dynamic tables have these columns
    // You may need to adjust based on your schema
    if (context.projectId) {
      // For BaaS, project isolation is by table name pattern, not column
      // So this is mainly for future use or custom implementations
    }

    if (context.userId) {
      conditions.push(`"user_id" = '${context.userId}'`);
    }

    return conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "WHERE 1=1";
  }
}
