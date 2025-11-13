import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import * as crypto from "crypto";

const execAsync = promisify(exec);

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  type?: "postgresql" | "mysql";
}

export interface CreateDatabaseOptions {
  projectId: string;
  projectSlug: string;
  config?: DatabaseConfig; // if not provided, use same server but new database
  useSameServer?: boolean; // if true, create DB on same server as main DB
}

/**
 * Database Manager Service
 * Handles multi-database architecture and database lifecycle
 */
export class DatabaseManagerService {
  private prisma: PrismaClient;
  private connections: Map<string, PrismaClient> = new Map();
  private encryptionKey: string;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
    this.encryptionKey = process.env.DB_ENCRYPTION_KEY || "default-key-change-in-production";
  }

  /**
   * Create a new database for a project
   */
  async createDatabase(options: CreateDatabaseOptions): Promise<DatabaseConfig> {
    const dbName = this.generateDatabaseName(options.projectSlug);

    if (options.useSameServer !== false) {
      // Create database on same server as main database
      const mainDbUrl = process.env.DATABASE_URL || "";
      const dbType = this.getDatabaseType(mainDbUrl);

      if (dbType === "postgresql") {
        return await this.createPostgresDatabase(dbName, mainDbUrl);
      } else if (dbType === "mysql") {
        return await this.createMySQLDatabase(dbName, mainDbUrl);
      } else {
        throw new Error("Unsupported database type");
      }
    } else {
      // Use custom database config
      if (!options.config) {
        throw new Error("Database config is required when not using same server");
      }
      return await this.createCustomDatabase(dbName, options.config);
    }
  }

  /**
   * Create PostgreSQL database on same server
   */
  private async createPostgresDatabase(
    dbName: string,
    mainDbUrl: string
  ): Promise<DatabaseConfig> {
    const config = this.parseConnectionUrl(mainDbUrl);

    // Create database using raw SQL
    try {
      // Connect to postgres database to create new database
      await this.prisma.$executeRawUnsafe(`CREATE DATABASE "${dbName}";`);
    } catch (error: any) {
      // Ignore error if database already exists
      if (!error.message?.includes("already exists")) {
        throw error;
      }
    }

    return {
      host: config.host,
      port: config.port,
      database: dbName,
      username: config.username,
      password: config.password,
      type: "postgresql",
    };
  }

  /**
   * Create MySQL database on same server
   */
  private async createMySQLDatabase(
    dbName: string,
    mainDbUrl: string
  ): Promise<DatabaseConfig> {
    const config = this.parseConnectionUrl(mainDbUrl);

    try {
      await this.prisma.$executeRawUnsafe(`CREATE DATABASE \`${dbName}\`;`);
    } catch (error: any) {
      if (!error.message?.includes("exists")) {
        throw error;
      }
    }

    return {
      host: config.host,
      port: config.port,
      database: dbName,
      username: config.username,
      password: config.password,
      type: "mysql",
    };
  }

  /**
   * Create database with custom config
   */
  private async createCustomDatabase(
    dbName: string,
    config: DatabaseConfig
  ): Promise<DatabaseConfig> {
    // This would involve connecting to the custom database server
    // and creating the database there
    // For now, return the config as-is
    return {
      ...config,
      database: dbName,
    };
  }

  /**
   * Get or create database connection for a project
   */
  async getConnection(projectId: string): Promise<PrismaClient> {
    // Check if connection already exists in cache
    if (this.connections.has(projectId)) {
      return this.connections.get(projectId)!;
    }

    // Load project from database
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project) {
      throw new Error(`Project ${projectId} not found`);
    }

    // If project doesn't use dedicated DB, return main connection
    if (!project.useDedicatedDb || !project.dbConnectionUrl) {
      return this.prisma;
    }

    // Create new connection for this project
    const connectionUrl = this.decryptConnectionUrl(project.dbConnectionUrl);
    const connection = new PrismaClient({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
    });

    // Cache the connection
    this.connections.set(projectId, connection);

    return connection;
  }

  /**
   * Build connection URL from config
   */
  buildConnectionUrl(config: DatabaseConfig): string {
    const { type = "postgresql", host, port, username, password, database } = config;

    if (type === "postgresql") {
      return `postgresql://${username}:${password}@${host}:${port}/${database}`;
    } else if (type === "mysql") {
      return `mysql://${username}:${password}@${host}:${port}/${database}`;
    } else {
      throw new Error(`Unsupported database type: ${type}`);
    }
  }

  /**
   * Parse connection URL to extract config
   */
  private parseConnectionUrl(url: string): DatabaseConfig {
    const match = url.match(/^(postgresql|mysql):\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);

    if (!match) {
      throw new Error("Invalid database connection URL");
    }

    return {
      type: match[1] as "postgresql" | "mysql",
      username: match[2],
      password: match[3],
      host: match[4],
      port: parseInt(match[5]),
      database: match[6],
    };
  }

  /**
   * Get database type from connection URL
   */
  private getDatabaseType(url: string): "postgresql" | "mysql" | null {
    if (url.startsWith("postgresql://")) return "postgresql";
    if (url.startsWith("mysql://")) return "mysql";
    return null;
  }

  /**
   * Generate unique database name
   */
  private generateDatabaseName(projectSlug: string): string {
    const sanitized = projectSlug.replace(/[^a-z0-9_]/g, "_").toLowerCase();
    const timestamp = Date.now().toString(36);
    return `baas_${sanitized}_${timestamp}`;
  }

  /**
   * Encrypt connection URL for storage
   */
  encryptConnectionUrl(url: string): string {
    const cipher = crypto.createCipher("aes-256-cbc", this.encryptionKey);
    let encrypted = cipher.update(url, "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  }

  /**
   * Decrypt connection URL
   */
  private decryptConnectionUrl(encrypted: string): string {
    const decipher = crypto.createDecipher("aes-256-cbc", this.encryptionKey);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Initialize database schema for a new project database
   */
  async initializeProjectDatabase(
    projectId: string,
    connectionUrl: string
  ): Promise<void> {
    // This would run migrations on the new database
    // For now, we'll just test the connection
    const testConnection = new PrismaClient({
      datasources: {
        db: {
          url: connectionUrl,
        },
      },
    });

    try {
      // Test connection
      await testConnection.$connect();
      console.log(`[DB Manager] Successfully initialized database for project ${projectId}`);
    } catch (error) {
      console.error(`[DB Manager] Failed to initialize database:`, error);
      throw error;
    } finally {
      await testConnection.$disconnect();
    }
  }

  /**
   * Drop database for a project
   */
  async dropDatabase(projectId: string): Promise<void> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
    });

    if (!project || !project.dbName) {
      throw new Error("Project or database name not found");
    }

    const dbType = this.getDatabaseType(process.env.DATABASE_URL || "");

    if (dbType === "postgresql") {
      await this.prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS "${project.dbName}";`);
    } else if (dbType === "mysql") {
      await this.prisma.$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${project.dbName}\`;`);
    }

    // Close connection if exists
    const connection = this.connections.get(projectId);
    if (connection) {
      await connection.$disconnect();
      this.connections.delete(projectId);
    }
  }

  /**
   * Get database status for a project
   */
  async getDatabaseStatus(projectId: string): Promise<{
    connected: boolean;
    error?: string;
  }> {
    try {
      const connection = await this.getConnection(projectId);
      await connection.$queryRaw`SELECT 1`;
      return { connected: true };
    } catch (error: any) {
      return {
        connected: false,
        error: error.message,
      };
    }
  }

  /**
   * Close all connections
   */
  async closeAll(): Promise<void> {
    const promises = Array.from(this.connections.values()).map((conn) =>
      conn.$disconnect()
    );
    await Promise.all(promises);
    this.connections.clear();
  }
}
