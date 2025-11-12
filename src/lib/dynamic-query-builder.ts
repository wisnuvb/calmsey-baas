import { PrismaClient, Prisma } from '@prisma/client';
import { FieldType, FieldDefinition, CollectionSchema, QueryParams } from '../types';

export class DynamicQueryBuilder {
  private prisma: PrismaClient;
  private projectId: string;
  private collectionSlug: string;
  private schema: CollectionSchema;
  private tableName: string;

  constructor(
    prisma: PrismaClient,
    projectId: string,
    collectionSlug: string,
    schema: CollectionSchema
  ) {
    this.prisma = prisma;
    this.projectId = projectId;
    this.collectionSlug = collectionSlug;
    this.schema = schema;
    // Table name format: {projectId}_{collectionSlug}
    this.tableName = `data_${projectId.replace(/-/g, '_')}_${collectionSlug}`;
  }

  /**
   * Ensure table exists, create if not
   */
  async ensureTableExists(): Promise<void> {
    const tableExists = await this.checkTableExists();
    
    if (!tableExists) {
      await this.createTable();
    }
  }

  /**
   * Check if table exists
   */
  private async checkTableExists(): Promise<boolean> {
    try {
      const result = await this.prisma.$queryRawUnsafe(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = '${this.tableName}'
        );
      `);
      
      return (result as any)[0].exists;
    } catch (err) {
      return false;
    }
  }

  /**
   * Create table based on schema
   */
  private async createTable(): Promise<void> {
    const columns = this.schema.fields.map(field => {
      return this.getColumnDefinition(field);
    }).join(',\n  ');

    const sql = `
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
        ${columns}
      );
    `;

    await this.prisma.$executeRawUnsafe(sql);

    // Create indexes for unique fields
    for (const field of this.schema.fields) {
      if (field.unique) {
        await this.prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "${this.tableName}_${field.name}_unique" 
          ON "${this.tableName}" ("${field.name}");
        `);
      }
    }
  }

  /**
   * Get SQL column definition from field
   */
  private getColumnDefinition(field: FieldDefinition): string {
    let sqlType = this.getSqlType(field.type);
    let constraints = [];

    if (field.required) {
      constraints.push('NOT NULL');
    }

    if (field.default !== undefined) {
      if (typeof field.default === 'string') {
        constraints.push(`DEFAULT '${field.default}'`);
      } else if (typeof field.default === 'boolean') {
        constraints.push(`DEFAULT ${field.default}`);
      } else if (field.default === null) {
        constraints.push('DEFAULT NULL');
      } else {
        constraints.push(`DEFAULT ${field.default}`);
      }
    }

    return `"${field.name}" ${sqlType} ${constraints.join(' ')}`;
  }

  /**
   * Map FieldType to SQL type
   */
  private getSqlType(fieldType: FieldType): string {
    const typeMap: Record<FieldType, string> = {
      [FieldType.STRING]: 'VARCHAR(255)',
      [FieldType.TEXT]: 'TEXT',
      [FieldType.NUMBER]: 'NUMERIC',
      [FieldType.BOOLEAN]: 'BOOLEAN',
      [FieldType.DATE]: 'DATE',
      [FieldType.DATETIME]: 'TIMESTAMP',
      [FieldType.EMAIL]: 'VARCHAR(255)',
      [FieldType.URL]: 'VARCHAR(500)',
      [FieldType.JSON]: 'JSONB',
      [FieldType.RELATION]: 'VARCHAR(255)',
      [FieldType.FILE]: 'VARCHAR(500)',
    };

    return typeMap[fieldType] || 'TEXT';
  }

  /**
   * Validate data against schema
   */
  validateData(data: Record<string, any>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const field of this.schema.fields) {
      const value = data[field.name];

      // Check required fields
      if (field.required && (value === undefined || value === null)) {
        errors.push(`Field '${field.name}' is required`);
        continue;
      }

      // Skip validation if value is not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Type validation
      if (!this.validateFieldType(value, field.type)) {
        errors.push(`Field '${field.name}' has invalid type`);
      }

      // Validation rules
      if (field.validation) {
        if (field.validation.min !== undefined && typeof value === 'number' && value < field.validation.min) {
          errors.push(`Field '${field.name}' must be at least ${field.validation.min}`);
        }

        if (field.validation.max !== undefined && typeof value === 'number' && value > field.validation.max) {
          errors.push(`Field '${field.name}' must be at most ${field.validation.max}`);
        }

        if (field.validation.pattern && typeof value === 'string') {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`Field '${field.name}' does not match pattern`);
          }
        }

        if (field.validation.enum && !field.validation.enum.includes(value)) {
          errors.push(`Field '${field.name}' must be one of: ${field.validation.enum.join(', ')}`);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate field type
   */
  private validateFieldType(value: any, type: FieldType): boolean {
    switch (type) {
      case FieldType.STRING:
      case FieldType.TEXT:
      case FieldType.EMAIL:
      case FieldType.URL:
      case FieldType.FILE:
        return typeof value === 'string';
      case FieldType.NUMBER:
        return typeof value === 'number';
      case FieldType.BOOLEAN:
        return typeof value === 'boolean';
      case FieldType.DATE:
      case FieldType.DATETIME:
        return value instanceof Date || typeof value === 'string';
      case FieldType.JSON:
        return typeof value === 'object';
      case FieldType.RELATION:
        return typeof value === 'string';
      default:
        return true;
    }
  }

  /**
   * Insert data
   */
  async insert(data: Record<string, any>): Promise<any> {
    await this.ensureTableExists();

    const validation = this.validateData(data);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
    }

    // Add timestamps if enabled
    if (this.schema.timestamps) {
      data.createdAt = new Date();
      data.updatedAt = new Date();
    }

    const columns = Object.keys(data).map(k => `"${k}"`).join(', ');
    const placeholders = Object.keys(data).map((_, i) => `$${i + 1}`).join(', ');
    const values = Object.values(data);

    const sql = `
      INSERT INTO "${this.tableName}" (${columns})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await this.prisma.$queryRawUnsafe(sql, ...values);
    return (result as any[])[0];
  }

  /**
   * Find many with pagination and filtering
   */
  async findMany(params: QueryParams = {}): Promise<{ data: any[]; total: number }> {
    await this.ensureTableExists();

    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      filter = {},
    } = params;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = '';
    const whereValues: any[] = [];
    
    if (this.schema.softDelete) {
      whereClause = 'WHERE "deletedAt" IS NULL';
    }

    if (Object.keys(filter).length > 0) {
      const conditions = Object.entries(filter).map(([key, value], index) => {
        whereValues.push(value);
        return `"${key}" = $${whereValues.length}`;
      });

      if (whereClause) {
        whereClause += ' AND ' + conditions.join(' AND ');
      } else {
        whereClause = 'WHERE ' + conditions.join(' AND ');
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(*) FROM "${this.tableName}" ${whereClause};`;
    const countResult = await this.prisma.$queryRawUnsafe(countSql, ...whereValues);
    const total = parseInt((countResult as any)[0].count);

    // Get data
    const dataSql = `
      SELECT * FROM "${this.tableName}"
      ${whereClause}
      ORDER BY "${sort}" ${order.toUpperCase()}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const data = await this.prisma.$queryRawUnsafe(dataSql, ...whereValues);

    return {
      data: data as any[],
      total,
    };
  }

  /**
   * Find one by ID
   */
  async findById(id: string): Promise<any | null> {
    await this.ensureTableExists();

    let whereClause = '"id" = $1';
    
    if (this.schema.softDelete) {
      whereClause += ' AND "deletedAt" IS NULL';
    }

    const sql = `SELECT * FROM "${this.tableName}" WHERE ${whereClause} LIMIT 1;`;
    const result = await this.prisma.$queryRawUnsafe(sql, id);
    
    return (result as any[])[0] || null;
  }

  /**
   * Update by ID
   */
  async update(id: string, data: Record<string, any>): Promise<any> {
    await this.ensureTableExists();

    // Validate only provided fields
    const partialValidation = this.validateData(data);
    if (!partialValidation.valid) {
      throw new Error(`Validation failed: ${partialValidation.errors.join(', ')}`);
    }

    // Add updatedAt if timestamps enabled
    if (this.schema.timestamps) {
      data.updatedAt = new Date();
    }

    const sets = Object.keys(data).map((key, i) => `"${key}" = $${i + 2}`).join(', ');
    const values = [id, ...Object.values(data)];

    const sql = `
      UPDATE "${this.tableName}"
      SET ${sets}
      WHERE "id" = $1
      RETURNING *;
    `;

    const result = await this.prisma.$queryRawUnsafe(sql, ...values);
    return (result as any[])[0];
  }

  /**
   * Delete by ID (soft or hard delete)
   */
  async delete(id: string): Promise<boolean> {
    await this.ensureTableExists();

    if (this.schema.softDelete) {
      // Soft delete
      const sql = `
        UPDATE "${this.tableName}"
        SET "deletedAt" = $1
        WHERE "id" = $2
        RETURNING *;
      `;
      const result = await this.prisma.$queryRawUnsafe(sql, new Date(), id);
      return (result as any[]).length > 0;
    } else {
      // Hard delete
      const sql = `DELETE FROM "${this.tableName}" WHERE "id" = $1;`;
      await this.prisma.$queryRawUnsafe(sql, id);
      return true;
    }
  }
}
