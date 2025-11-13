import { PrismaClient } from "@prisma/client";
import { FieldType, FieldDefinition, CollectionSchema } from "../types";

export interface SchemaChange {
  type: "add" | "remove" | "modify" | "rename";
  field: FieldDefinition;
  oldField?: FieldDefinition;
  oldType?: FieldType;
}

export interface MigrationResult {
  success: boolean;
  changes: SchemaChange[];
  sqlStatements: string[];
  errors?: string[];
  warnings?: string[];
}

export class SchemaMigrationService {
  private prisma: PrismaClient;
  private projectId: string;
  private collectionSlug: string;
  private tableName: string;

  constructor(prisma: PrismaClient, projectId: string, collectionSlug: string) {
    this.prisma = prisma;
    this.projectId = projectId;
    this.collectionSlug = collectionSlug;
    this.tableName = `data_${projectId.replace(/-/g, "_")}_${collectionSlug}`;
  }

  /**
   * Detect changes between old and new schema
   */
  detectChanges(
    oldSchema: CollectionSchema,
    newSchema: CollectionSchema
  ): SchemaChange[] {
    const changes: SchemaChange[] = [];

    // Filter out system fields (id, createdAt, updatedAt, deletedAt)
    // But we still need to track deletedAt changes for soft delete
    const systemFields = ["id", "createdAt", "updatedAt"];

    const oldFields = oldSchema.fields.filter(
      (f) => !systemFields.includes(f.name)
    );
    const newFields = newSchema.fields.filter(
      (f) => !systemFields.includes(f.name)
    );

    // Create maps for easier lookup
    const oldFieldMap = new Map<string, FieldDefinition>();
    oldFields.forEach((f) => oldFieldMap.set(f.name, f));

    const newFieldMap = new Map<string, FieldDefinition>();
    newFields.forEach((f) => newFieldMap.set(f.name, f));

    // Detect new fields
    newFields.forEach((field) => {
      if (!oldFieldMap.has(field.name)) {
        changes.push({
          type: "add",
          field,
        });
      }
    });

    // Detect removed fields
    oldFields.forEach((field) => {
      if (!newFieldMap.has(field.name)) {
        changes.push({
          type: "remove",
          field,
        });
      }
    });

    // Detect modified fields
    newFields.forEach((newField) => {
      const oldField = oldFieldMap.get(newField.name);
      if (oldField) {
        // Check if type changed
        if (oldField.type !== newField.type) {
          changes.push({
            type: "modify",
            field: newField,
            oldField,
            oldType: oldField.type,
          });
        }
        // Check if required changed
        else if (oldField.required !== newField.required) {
          changes.push({
            type: "modify",
            field: newField,
            oldField,
          });
        }
        // Check if unique changed
        else if (oldField.unique !== newField.unique) {
          changes.push({
            type: "modify",
            field: newField,
            oldField,
          });
        }
      }
    });

    // Handle deletedAt separately based on softDelete flag
    const oldHasDeletedAt = oldSchema.softDelete ?? false;
    const newHasDeletedAt = newSchema.softDelete ?? false;

    if (oldHasDeletedAt !== newHasDeletedAt) {
      const deletedAtField: FieldDefinition = {
        name: "deletedAt",
        type: FieldType.DATETIME,
        required: false,
      };

      if (newHasDeletedAt && !oldHasDeletedAt) {
        changes.push({
          type: "add",
          field: deletedAtField,
        });
      } else if (!newHasDeletedAt && oldHasDeletedAt) {
        changes.push({
          type: "remove",
          field: deletedAtField,
        });
      }
    }

    return changes;
  }

  /**
   * Generate SQL statements for migration
   */
  generateMigrationSQL(
    changes: SchemaChange[],
    options: {
      safeMode?: boolean; // If true, don't drop columns, just mark as deprecated
      allowDataLoss?: boolean; // If true, allow dropping columns with data
    } = {}
  ): string[] {
    const sqlStatements: string[] = [];
    const { safeMode = true, allowDataLoss = false } = options;

    for (const change of changes) {
      switch (change.type) {
        case "add":
          sqlStatements.push(this.generateAddColumnSQL(change.field));
          break;

        case "remove":
          if (safeMode) {
            // In safe mode, we don't drop columns
            // Could add a deprecated flag or just skip
            sqlStatements.push(
              `-- WARNING: Column "${change.field.name}" should be removed but safe mode is enabled`
            );
          } else {
            if (allowDataLoss) {
              sqlStatements.push(this.generateDropColumnSQL(change.field));
            } else {
              // Check if column has data first
              sqlStatements.push(
                `-- ERROR: Cannot drop column "${change.field.name}" - contains data. Set allowDataLoss=true to force.`
              );
            }
          }
          break;

        case "modify":
          sqlStatements.push(
            ...this.generateModifyColumnSQL(change.field, change.oldField!)
          );
          break;
      }
    }

    return sqlStatements;
  }

  /**
   * Generate SQL to add a column
   */
  private generateAddColumnSQL(field: FieldDefinition): string {
    const columnDef = this.getColumnDefinition(field);
    return `ALTER TABLE "${this.tableName}" ADD COLUMN ${columnDef};`;
  }

  /**
   * Generate SQL to drop a column
   */
  private generateDropColumnSQL(field: FieldDefinition): string {
    return `ALTER TABLE "${this.tableName}" DROP COLUMN IF EXISTS "${field.name}";`;
  }

  /**
   * Generate SQL to modify a column
   */
  private generateModifyColumnSQL(
    newField: FieldDefinition,
    oldField: FieldDefinition
  ): string[] {
    const statements: string[] = [];

    // Type change
    if (newField.type !== oldField.type) {
      const newSqlType = this.getSqlType(newField.type);
      const oldSqlType = this.getSqlType(oldField.type);

      // Check if conversion is safe
      if (this.isTypeConversionSafe(oldField.type, newField.type)) {
        statements.push(
          `ALTER TABLE "${this.tableName}" ALTER COLUMN "${newField.name}" TYPE ${newSqlType};`
        );
      } else {
        statements.push(
          `-- WARNING: Type conversion from ${oldSqlType} to ${newSqlType} may cause data loss`
        );
        statements.push(
          `-- Manual migration required for column "${newField.name}"`
        );
      }
    }

    // Required constraint change
    if (newField.required !== oldField.required) {
      if (newField.required) {
        // Add NOT NULL constraint (only if column has no NULL values)
        statements.push(
          `-- WARNING: Adding NOT NULL constraint to "${newField.name}" - ensure no NULL values exist`
        );
        statements.push(
          `ALTER TABLE "${this.tableName}" ALTER COLUMN "${newField.name}" SET NOT NULL;`
        );
      } else {
        statements.push(
          `ALTER TABLE "${this.tableName}" ALTER COLUMN "${newField.name}" DROP NOT NULL;`
        );
      }
    }

    // Default value change
    if (JSON.stringify(newField.default) !== JSON.stringify(oldField.default)) {
      if (newField.default !== undefined) {
        const defaultValue =
          typeof newField.default === "string"
            ? `'${newField.default}'`
            : newField.default;
        statements.push(
          `ALTER TABLE "${this.tableName}" ALTER COLUMN "${newField.name}" SET DEFAULT ${defaultValue};`
        );
      } else {
        statements.push(
          `ALTER TABLE "${this.tableName}" ALTER COLUMN "${newField.name}" DROP DEFAULT;`
        );
      }
    }

    // Unique constraint change
    if (newField.unique !== oldField.unique) {
      if (newField.unique) {
        statements.push(
          `CREATE UNIQUE INDEX IF NOT EXISTS "${this.tableName}_${newField.name}_unique" ON "${this.tableName}" ("${newField.name}");`
        );
      } else {
        statements.push(
          `DROP INDEX IF EXISTS "${this.tableName}_${newField.name}_unique";`
        );
      }
    }

    // Index change (non-unique)
    if (newField.indexed !== oldField.indexed) {
      if (newField.indexed) {
        statements.push(
          `CREATE INDEX IF NOT EXISTS "${this.tableName}_${newField.name}_idx" ON "${this.tableName}" ("${newField.name}");`
        );
      } else {
        statements.push(
          `DROP INDEX IF EXISTS "${this.tableName}_${newField.name}_idx";`
        );
      }
    }

    return statements;
  }

  /**
   * Check if type conversion is safe
   */
  private isTypeConversionSafe(
    oldType: FieldType,
    newType: FieldType
  ): boolean {
    // Safe conversions
    const safeConversions: Record<FieldType, FieldType[]> = {
      [FieldType.STRING]: [FieldType.TEXT, FieldType.EMAIL, FieldType.URL],
      [FieldType.TEXT]: [FieldType.STRING],
      [FieldType.EMAIL]: [FieldType.STRING, FieldType.TEXT],
      [FieldType.URL]: [FieldType.STRING, FieldType.TEXT],
      [FieldType.NUMBER]: [],
      [FieldType.BOOLEAN]: [],
      [FieldType.DATE]: [FieldType.DATETIME],
      [FieldType.DATETIME]: [FieldType.DATE],
      [FieldType.JSON]: [],
      [FieldType.RELATION]: [FieldType.STRING],
      [FieldType.FILE]: [FieldType.STRING, FieldType.URL],
    };

    return safeConversions[oldType]?.includes(newType) || false;
  }

  /**
   * Get SQL column definition
   */
  private getColumnDefinition(field: FieldDefinition): string {
    let sqlType = this.getSqlType(field.type);
    let constraints: string[] = [];

    if (field.required) {
      constraints.push("NOT NULL");
    }

    if (field.default !== undefined) {
      if (typeof field.default === "string") {
        constraints.push(`DEFAULT '${field.default}'`);
      } else if (typeof field.default === "boolean") {
        constraints.push(`DEFAULT ${field.default}`);
      } else if (field.default === null) {
        constraints.push("DEFAULT NULL");
      } else {
        constraints.push(`DEFAULT ${field.default}`);
      }
    }

    return `"${field.name}" ${sqlType} ${constraints.join(" ")}`;
  }

  /**
   * Map FieldType to SQL type
   */
  private getSqlType(fieldType: FieldType): string {
    const typeMap: Record<FieldType, string> = {
      [FieldType.STRING]: "VARCHAR(255)",
      [FieldType.TEXT]: "TEXT",
      [FieldType.NUMBER]: "NUMERIC",
      [FieldType.BOOLEAN]: "BOOLEAN",
      [FieldType.DATE]: "DATE",
      [FieldType.DATETIME]: "TIMESTAMP",
      [FieldType.EMAIL]: "VARCHAR(255)",
      [FieldType.URL]: "VARCHAR(500)",
      [FieldType.JSON]: "JSONB",
      [FieldType.RELATION]: "VARCHAR(255)",
      [FieldType.FILE]: "VARCHAR(500)",
    };

    return typeMap[fieldType] || "TEXT";
  }

  /**
   * Execute migration
   */
  async executeMigration(
    oldSchema: CollectionSchema,
    newSchema: CollectionSchema,
    options: {
      safeMode?: boolean;
      allowDataLoss?: boolean;
      dryRun?: boolean;
    } = {}
  ): Promise<MigrationResult> {
    const { safeMode = true, allowDataLoss = false, dryRun = false } = options;

    try {
      // Detect changes
      const changes = this.detectChanges(oldSchema, newSchema);

      if (changes.length === 0) {
        return {
          success: true,
          changes: [],
          sqlStatements: [],
          warnings: ["No schema changes detected"],
        };
      }

      // Generate SQL
      const sqlStatements = this.generateMigrationSQL(changes, {
        safeMode,
        allowDataLoss,
      });

      // Check for errors in SQL generation
      const errors = sqlStatements.filter((sql) => sql.startsWith("-- ERROR"));
      const warnings = sqlStatements.filter((sql) =>
        sql.startsWith("-- WARNING")
      );

      if (errors.length > 0 && !allowDataLoss) {
        return {
          success: false,
          changes,
          sqlStatements,
          errors: errors.map((e) => e.replace("-- ERROR: ", "")),
          warnings: warnings.map((w) => w.replace("-- WARNING: ", "")),
        };
      }

      // Execute SQL if not dry run
      if (!dryRun) {
        for (const sql of sqlStatements) {
          // Skip comments
          if (sql.startsWith("--")) {
            continue;
          }

          try {
            await this.prisma.$executeRawUnsafe(sql);
          } catch (err: any) {
            return {
              success: false,
              changes,
              sqlStatements,
              errors: [`Failed to execute SQL: ${sql}. Error: ${err.message}`],
              warnings: warnings.map((w) => w.replace("-- WARNING: ", "")),
            };
          }
        }

        // Update indexes for unique fields
        for (const change of changes) {
          if (change.type === "add" && change.field.unique) {
            await this.prisma.$executeRawUnsafe(`
              CREATE UNIQUE INDEX IF NOT EXISTS "${this.tableName}_${change.field.name}_unique" 
              ON "${this.tableName}" ("${change.field.name}");
            `);
          } else if (change.type === "add" && change.field.indexed) {
            // Create non-unique index for new indexed fields
            await this.prisma.$executeRawUnsafe(`
              CREATE INDEX IF NOT EXISTS "${this.tableName}_${change.field.name}_idx" 
              ON "${this.tableName}" ("${change.field.name}");
            `);
          }
        }
      }

      return {
        success: true,
        changes,
        sqlStatements,
        warnings: warnings.map((w) => w.replace("-- WARNING: ", "")),
      };
    } catch (err: any) {
      return {
        success: false,
        changes: [],
        sqlStatements: [],
        errors: [err.message || "Unknown error during migration"],
      };
    }
  }
}
