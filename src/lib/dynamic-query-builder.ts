import { PrismaClient, Prisma } from "@prisma/client";
import {
  FieldType,
  FieldDefinition,
  CollectionSchema,
  QueryParams,
} from "../types";

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
    this.tableName = `data_${projectId.replace(/-/g, "_")}_${collectionSlug}`;
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
  async createTable(): Promise<void> {
    // Filter out 'id' field from schema since it's automatically created
    const fieldsWithoutId = this.schema.fields.filter(
      (field) => field.name !== "id"
    );
    const columns = fieldsWithoutId
      .map((field) => {
        return this.getColumnDefinition(field);
      })
      .join(",\n  ");

    // Determine ID type (default to UUID)
    const idType = this.schema.idType || "uuid";
    let idColumn: string;

    if (idType === "autoincrement") {
      // PostgreSQL SERIAL for auto-increment
      idColumn = "id SERIAL PRIMARY KEY";
    } else {
      // UUID with default generation
      idColumn = "id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text";
    }

    const sql = `
      CREATE TABLE IF NOT EXISTS "${this.tableName}" (
        ${idColumn},
        ${columns}
      );
    `;

    await this.prisma.$executeRawUnsafe(sql);

    // Create indexes and foreign keys for relation fields
    for (const field of fieldsWithoutId) {
      if (field.unique) {
        await this.prisma.$executeRawUnsafe(`
          CREATE UNIQUE INDEX IF NOT EXISTS "${this.tableName}_${field.name}_unique" 
          ON "${this.tableName}" ("${field.name}");
        `);
      } else if (field.indexed) {
        await this.prisma.$executeRawUnsafe(`
          CREATE INDEX IF NOT EXISTS "${this.tableName}_${field.name}_idx" 
          ON "${this.tableName}" ("${field.name}");
        `);
      }

      // Add foreign key constraint for relation fields (one-to-one, one-to-many)
      if (
        field.type === FieldType.RELATION &&
        field.relation &&
        (field.relation.type === "one-to-one" ||
          field.relation.type === "one-to-many")
      ) {
        try {
          const relatedTableName = `data_${this.projectId.replace(/-/g, "_")}_${
            field.relation.collection
          }`;

          // Check if related table exists
          const tableExists = await this.prisma.$queryRawUnsafe(`
            SELECT EXISTS (
              SELECT FROM information_schema.tables 
              WHERE table_name = '${relatedTableName}'
            );
          `);

          if ((tableExists as any[])[0].exists) {
            // Create foreign key constraint
            const fkName = `${this.tableName}_${field.name}_fk`;
            await this.prisma.$executeRawUnsafe(`
              DO $$ 
              BEGIN
                IF NOT EXISTS (
                  SELECT 1 FROM pg_constraint WHERE conname = '${fkName}'
                ) THEN
                  ALTER TABLE "${this.tableName}"
                  ADD CONSTRAINT "${fkName}"
                  FOREIGN KEY ("${field.name}")
                  REFERENCES "${relatedTableName}" ("id")
                  ON DELETE ${
                    field.relation.type === "one-to-many"
                      ? "SET NULL"
                      : "CASCADE"
                  };
                END IF;
              END $$;
            `);

            // Create index for foreign key (for performance)
            await this.prisma.$executeRawUnsafe(`
              CREATE INDEX IF NOT EXISTS "${this.tableName}_${field.name}_fk_idx" 
              ON "${this.tableName}" ("${field.name}");
            `);
          }
        } catch (err) {
          // Log but don't fail - FK might not be possible if table doesn't exist yet
          console.warn(`Failed to create FK for ${field.name}:`, err);
        }
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
   * Validate relation field - check if referenced record exists
   */
  private async validateRelation(
    field: FieldDefinition,
    value: string,
    projectId: string
  ): Promise<boolean> {
    if (!field.relation) {
      return true;
    }

    try {
      const relatedCollection = await this.prisma.collection.findFirst({
        where: {
          slug: field.relation.collection,
          projectId,
        },
      });

      if (!relatedCollection) {
        return false;
      }

      const relatedTableName = `data_${projectId.replace(/-/g, "_")}_${
        field.relation.collection
      }`;

      // Check if related record exists
      const result = await this.prisma.$queryRawUnsafe(
        `SELECT id FROM "${relatedTableName}" WHERE id = $1 LIMIT 1;`,
        value
      );

      return (result as any[]).length > 0;
    } catch (err) {
      return false;
    }
  }

  /**
   * Validate data against schema (updated to include relation validation)
   */
  validateData(data: Record<string, any>): {
    valid: boolean;
    errors: string[];
  } {
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

      // Relation validation (async - will be handled in insert/update)
      if (field.type === FieldType.RELATION && field.relation) {
        // This will be validated in insert/update methods
      }

      // Validation rules
      if (field.validation) {
        if (
          field.validation.min !== undefined &&
          typeof value === "number" &&
          value < field.validation.min
        ) {
          errors.push(
            `Field '${field.name}' must be at least ${field.validation.min}`
          );
        }

        if (
          field.validation.max !== undefined &&
          typeof value === "number" &&
          value > field.validation.max
        ) {
          errors.push(
            `Field '${field.name}' must be at most ${field.validation.max}`
          );
        }

        if (field.validation.pattern && typeof value === "string") {
          const regex = new RegExp(field.validation.pattern);
          if (!regex.test(value)) {
            errors.push(`Field '${field.name}' does not match pattern`);
          }
        }

        if (field.validation.enum && !field.validation.enum.includes(value)) {
          errors.push(
            `Field '${field.name}' must be one of: ${field.validation.enum.join(
              ", "
            )}`
          );
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
        return typeof value === "string";
      case FieldType.NUMBER:
        return typeof value === "number";
      case FieldType.BOOLEAN:
        return typeof value === "boolean";
      case FieldType.DATE:
      case FieldType.DATETIME:
        return value instanceof Date || typeof value === "string";
      case FieldType.JSON:
        return typeof value === "object";
      case FieldType.RELATION:
        return typeof value === "string";
      default:
        return true;
    }
  }

  /**
   * Populate relations for a single record
   */
  async populateRelations(
    record: any,
    relationsToPopulate: string[],
    projectId: string
  ): Promise<any> {
    if (!relationsToPopulate || relationsToPopulate.length === 0) {
      return record;
    }

    const populated = { ...record };

    for (const fieldName of relationsToPopulate) {
      const field = this.schema.fields.find((f) => f.name === fieldName);

      if (!field || field.type !== FieldType.RELATION || !field.relation) {
        continue;
      }

      const relationValue = record[fieldName];
      if (!relationValue) {
        populated[fieldName] = null;
        continue;
      }

      try {
        const relatedCollection = await this.prisma.collection.findFirst({
          where: {
            slug: field.relation.collection,
            projectId,
          },
        });

        if (!relatedCollection) {
          populated[fieldName] = null;
          continue;
        }

        const relatedTableName = `data_${projectId.replace(/-/g, "_")}_${
          field.relation.collection
        }`;

        // Handle different relation types
        if (
          field.relation.type === "one-to-one" ||
          field.relation.type === "one-to-many"
        ) {
          // Single value - fetch the related record
          const relatedRecord = await this.prisma.$queryRawUnsafe(
            `SELECT * FROM "${relatedTableName}" WHERE id = $1 LIMIT 1;`,
            relationValue
          );

          populated[fieldName] = (relatedRecord as any[])[0] || null;
        } else if (field.relation.type === "many-to-many") {
          // Many-to-many: relationValue should be an array of IDs
          if (Array.isArray(relationValue)) {
            const placeholders = relationValue
              .map((_, i) => `$${i + 1}`)
              .join(", ");
            const relatedRecords = await this.prisma.$queryRawUnsafe(
              `SELECT * FROM "${relatedTableName}" WHERE id IN (${placeholders});`,
              ...relationValue
            );

            populated[fieldName] = relatedRecords as any[];
          } else {
            populated[fieldName] = [];
          }
        }
      } catch (err) {
        // If population fails, keep original value
        populated[fieldName] = relationValue;
      }
    }

    return populated;
  }

  /**
   * Insert data (updated with relation validation)
   */
  async insert(data: Record<string, any>): Promise<any> {
    await this.ensureTableExists();

    // Remove 'id' from data if it exists (will be auto-generated)
    const { id, ...dataWithoutId } = data;

    // Auto-convert data types based on schema before validation
    const convertedData = this.convertDataTypes(dataWithoutId);

    const validation = this.validateData(convertedData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    // Validate relations
    for (const field of this.schema.fields) {
      if (field.type === FieldType.RELATION && field.relation) {
        const value = data[field.name];
        if (value !== undefined && value !== null) {
          // Handle many-to-many (array of IDs)
          if (field.relation.type === "many-to-many") {
            if (Array.isArray(value)) {
              for (const id of value) {
                const isValid = await this.validateRelation(
                  field,
                  id,
                  this.projectId
                );
                if (!isValid) {
                  throw new Error(
                    `Relation '${field.name}' contains invalid reference: ${id}`
                  );
                }
              }
            }
          } else {
            // one-to-one or one-to-many (single ID)
            const isValid = await this.validateRelation(
              field,
              value,
              this.projectId
            );
            if (!isValid) {
              throw new Error(
                `Relation '${field.name}' references non-existent record: ${value}`
              );
            }
          }
        }
      }
    }

    // Add timestamps if enabled
    if (this.schema.timestamps) {
      convertedData.createdAt = new Date();
      convertedData.updatedAt = new Date();
    }

    // Handle many-to-many relations (store as JSON array)
    const processedData: Record<string, any> = { ...convertedData };
    for (const field of this.schema.fields) {
      if (
        field.type === FieldType.RELATION &&
        field.relation?.type === "many-to-many" &&
        processedData[field.name]
      ) {
        // Store as JSON string
        processedData[field.name] = JSON.stringify(processedData[field.name]);
      }
    }

    const columns = Object.keys(processedData)
      .map((k) => `"${k}"`)
      .join(", ");
    const placeholders = Object.keys(processedData)
      .map((_, i) => `$${i + 1}`)
      .join(", ");
    const values = Object.values(processedData);

    const sql = `
      INSERT INTO "${this.tableName}" (${columns})
      VALUES (${placeholders})
      RETURNING *;
    `;

    const result = await this.prisma.$queryRawUnsafe(sql, ...values);
    const inserted = (result as any[])[0];

    // Parse JSON for many-to-many relations
    for (const field of this.schema.fields) {
      if (
        field.type === FieldType.RELATION &&
        field.relation?.type === "many-to-many" &&
        inserted[field.name]
      ) {
        try {
          inserted[field.name] = JSON.parse(inserted[field.name]);
        } catch {
          // Keep as is if parsing fails
        }
      }
    }

    return inserted;
  }

  /**
   * Auto-convert data types based on schema
   */
  private convertDataTypes(data: Record<string, any>): Record<string, any> {
    const converted: Record<string, any> = { ...data };

    for (const field of this.schema.fields) {
      const value = converted[field.name];

      // Skip if value is undefined, null, or already correct type
      if (value === undefined || value === null) {
        continue;
      }

      try {
        switch (field.type) {
          case FieldType.NUMBER:
            if (typeof value === "string" && value.trim() !== "") {
              const num = Number(value);
              if (!isNaN(num)) {
                converted[field.name] = num;
              }
            }
            break;

          case FieldType.BOOLEAN:
            if (typeof value === "string") {
              const lower = value.toLowerCase().trim();
              if (lower === "true" || lower === "1" || lower === "yes") {
                converted[field.name] = true;
              } else if (lower === "false" || lower === "0" || lower === "no") {
                converted[field.name] = false;
              }
            }
            break;

          case FieldType.DATE:
          case FieldType.DATETIME:
            if (typeof value === "string" && value.trim() !== "") {
              const date = new Date(value);
              if (!isNaN(date.getTime())) {
                converted[field.name] = date.toISOString();
              }
            }
            break;

          case FieldType.JSON:
            if (typeof value === "string" && value.trim() !== "") {
              try {
                converted[field.name] = JSON.parse(value);
              } catch {
                // Keep as string if parsing fails
              }
            }
            break;
        }
      } catch {
        // Keep original value if conversion fails
      }
    }

    return converted;
  }

  /**
   * Build WHERE clause from advanced filter
   */
  private buildWhereClauseFromFilter(
    filter: any,
    whereValues: any[],
    prefix: string = ""
  ): string {
    if (!filter || typeof filter !== "object") {
      return "";
    }

    const conditions: string[] = [];

    // Handle logical operators
    if (filter.$or) {
      const orConditions = filter.$or
        .map((f: any) =>
          this.buildWhereClauseFromFilter(f, whereValues, prefix)
        )
        .filter((c: string) => c)
        .map((c: string) => `(${c})`);
      if (orConditions.length > 0) {
        conditions.push(`(${orConditions.join(" OR ")})`);
      }
    }

    if (filter.$and) {
      const andConditions = filter.$and
        .map((f: any) =>
          this.buildWhereClauseFromFilter(f, whereValues, prefix)
        )
        .filter((c: string) => c);
      conditions.push(...andConditions);
    }

    if (filter.$not) {
      const notCondition = this.buildWhereClauseFromFilter(
        filter.$not,
        whereValues,
        prefix
      );
      if (notCondition) {
        conditions.push(`NOT (${notCondition})`);
      }
    }

    // Handle field operators
    for (const [field, value] of Object.entries(filter)) {
      if (field.startsWith("$")) continue; // Skip logical operators

      const fieldName = `"${field}"`;
      const fieldDef = this.schema.fields.find((f) => f.name === field);

      if (
        typeof value === "object" &&
        value !== null &&
        !Array.isArray(value)
      ) {
        // Advanced operators
        for (const [op, opValue] of Object.entries(value)) {
          whereValues.push(opValue);
          const paramIndex = whereValues.length;

          switch (op) {
            case "$eq":
              conditions.push(`${fieldName} = $${paramIndex}`);
              break;
            case "$ne":
              conditions.push(`${fieldName} != $${paramIndex}`);
              break;
            case "$gt":
              conditions.push(`${fieldName} > $${paramIndex}`);
              break;
            case "$gte":
              conditions.push(`${fieldName} >= $${paramIndex}`);
              break;
            case "$lt":
              conditions.push(`${fieldName} < $${paramIndex}`);
              break;
            case "$lte":
              conditions.push(`${fieldName} <= $${paramIndex}`);
              break;
            case "$in":
              if (Array.isArray(opValue)) {
                const placeholders = opValue
                  .map(
                    (_, i) => `$${whereValues.length - opValue.length + i + 1}`
                  )
                  .join(", ");
                conditions.push(`${fieldName} IN (${placeholders})`);
              }
              break;
            case "$nin":
              if (Array.isArray(opValue)) {
                const placeholders = opValue
                  .map(
                    (_, i) => `$${whereValues.length - opValue.length + i + 1}`
                  )
                  .join(", ");
                conditions.push(`${fieldName} NOT IN (${placeholders})`);
              }
              break;
            case "$like":
              conditions.push(`${fieldName} LIKE $${paramIndex}`);
              break;
            case "$ilike":
              conditions.push(`${fieldName} ILIKE $${paramIndex}`);
              break;
            case "$isNull":
              if (opValue === true) {
                conditions.push(`${fieldName} IS NULL`);
                whereValues.pop(); // Remove the value we just added
              }
              break;
            case "$isNotNull":
              if (opValue === true) {
                conditions.push(`${fieldName} IS NOT NULL`);
                whereValues.pop();
              }
              break;
            case "$between":
              if (Array.isArray(opValue) && opValue.length === 2) {
                whereValues.push(opValue[1]);
                conditions.push(
                  `${fieldName} BETWEEN $${paramIndex} AND $${whereValues.length}`
                );
              }
              break;
            case "$startsWith":
              whereValues[whereValues.length - 1] = `${opValue}%`;
              conditions.push(`${fieldName}::text ILIKE $${paramIndex}`);
              break;
            case "$endsWith":
              whereValues[whereValues.length - 1] = `%${opValue}`;
              conditions.push(`${fieldName}::text ILIKE $${paramIndex}`);
              break;
            case "$contains":
              whereValues[whereValues.length - 1] = `%${opValue}%`;
              conditions.push(`${fieldName}::text ILIKE $${paramIndex}`);
              break;
          }
        }
      } else {
        // Simple equality (backward compatible)
        whereValues.push(value);
        conditions.push(`${fieldName} = $${whereValues.length}`);
      }
    }

    return conditions.join(" AND ");
  }

  /**
   * Find many with advanced filtering support
   */
  async findMany(
    params: QueryParams = {}
  ): Promise<{ data: any[]; total: number }> {
    await this.ensureTableExists();

    const {
      page = 1,
      limit = 10,
      sort = "createdAt",
      order = "desc",
      filter = {},
      search,
      populate,
      fields,
    } = params;

    const offset = (page - 1) * limit;

    // Build WHERE clause
    let whereClause = "";
    const whereValues: any[] = [];

    // Soft delete filter
    if (this.schema.softDelete) {
      whereClause = 'WHERE "deletedAt" IS NULL';
    }

    // Advanced filter support
    if (filter && Object.keys(filter).length > 0) {
      const filterConditions = this.buildWhereClauseFromFilter(
        filter,
        whereValues
      );

      if (filterConditions) {
        if (whereClause) {
          whereClause += " AND " + filterConditions;
        } else {
          whereClause = "WHERE " + filterConditions;
        }
      }
    }

    // Add search functionality (keep existing)
    if (search && search.trim()) {
      const searchTerm = `%${search.trim()}%`;
      const searchableFields = this.schema.fields.filter(
        (field) =>
          field.type === FieldType.STRING ||
          field.type === FieldType.TEXT ||
          field.type === FieldType.EMAIL ||
          field.type === FieldType.URL
      );

      if (searchableFields.length > 0) {
        const searchConditions = searchableFields.map((field) => {
          whereValues.push(searchTerm);
          return `"${field.name}"::text ILIKE $${whereValues.length}`;
        });

        const searchClause = `(${searchConditions.join(" OR ")})`;

        if (whereClause) {
          whereClause += " AND " + searchClause;
        } else {
          whereClause = "WHERE " + searchClause;
        }
      }
    }

    // Field selection
    let selectFields = "*";
    if (fields) {
      const fieldList = Array.isArray(fields) ? fields : fields.split(",");
      const validFields = fieldList
        .map((f) => f.trim())
        .filter((f) => {
          // Allow system fields and fields from schema
          return (
            f === "id" ||
            f.startsWith("createdAt") ||
            f.startsWith("updatedAt") ||
            f.startsWith("deletedAt") ||
            this.schema.fields.some((field) => field.name === f)
          );
        });
      if (validFields.length > 0) {
        selectFields = validFields.map((f) => `"${f}"`).join(", ");
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(*) FROM "${this.tableName}" ${whereClause};`;
    const countResult = await this.prisma.$queryRawUnsafe(
      countSql,
      ...whereValues
    );
    const total = parseInt((countResult as any)[0].count);

    // Get data
    const dataSql = `
      SELECT ${selectFields} FROM "${this.tableName}"
      ${whereClause}
      ORDER BY "${sort}" ${order.toUpperCase()}
      LIMIT ${limit} OFFSET ${offset};
    `;

    const data = await this.prisma.$queryRawUnsafe(dataSql, ...whereValues);

    // Parse JSON for many-to-many relations
    const parsedData = (data as any[]).map((record) => {
      const parsed = { ...record };
      for (const field of this.schema.fields) {
        if (
          field.type === FieldType.RELATION &&
          field.relation?.type === "many-to-many" &&
          parsed[field.name]
        ) {
          try {
            parsed[field.name] = JSON.parse(parsed[field.name]);
          } catch {
            // Keep as is if parsing fails
          }
        }
      }
      return parsed;
    });

    // Populate relations if requested
    let finalData = parsedData;
    if (populate) {
      const relationsToPopulate = Array.isArray(populate)
        ? populate
        : [populate];

      finalData = await Promise.all(
        parsedData.map((record) =>
          this.populateRelations(record, relationsToPopulate, this.projectId)
        )
      );
    }

    return {
      data: finalData,
      total,
    };
  }

  /**
   * Find one by ID (updated with populate support)
   */
  async findById(
    id: string,
    populate?: string | string[]
  ): Promise<any | null> {
    await this.ensureTableExists();

    let whereClause = '"id" = $1';

    if (this.schema.softDelete) {
      whereClause += ' AND "deletedAt" IS NULL';
    }

    const sql = `SELECT * FROM "${this.tableName}" WHERE ${whereClause} LIMIT 1;`;
    const result = await this.prisma.$queryRawUnsafe(sql, id);

    const record = (result as any[])[0] || null;

    if (!record) {
      return null;
    }

    // Parse JSON for many-to-many relations
    const parsed = { ...record };
    for (const field of this.schema.fields) {
      if (
        field.type === FieldType.RELATION &&
        field.relation?.type === "many-to-many" &&
        parsed[field.name]
      ) {
        try {
          parsed[field.name] = JSON.parse(parsed[field.name]);
        } catch {
          // Keep as is if parsing fails
        }
      }
    }

    // Populate relations if requested
    if (populate) {
      const relationsToPopulate = Array.isArray(populate)
        ? populate
        : [populate];
      return this.populateRelations(
        parsed,
        relationsToPopulate,
        this.projectId
      );
    }

    return parsed;
  }

  /**
   * Update by ID (updated with relation validation)
   */
  async update(id: string, data: Record<string, any>): Promise<any> {
    await this.ensureTableExists();

    // Validate only provided fields
    const partialValidation = this.validateData(data);
    if (!partialValidation.valid) {
      throw new Error(
        `Validation failed: ${partialValidation.errors.join(", ")}`
      );
    }

    // Validate relations
    for (const field of this.schema.fields) {
      if (
        field.type === FieldType.RELATION &&
        field.relation &&
        data[field.name] !== undefined
      ) {
        const value = data[field.name];
        if (value !== null) {
          if (field.relation.type === "many-to-many") {
            if (Array.isArray(value)) {
              for (const relationId of value) {
                const isValid = await this.validateRelation(
                  field,
                  relationId,
                  this.projectId
                );
                if (!isValid) {
                  throw new Error(
                    `Relation '${field.name}' contains invalid reference: ${relationId}`
                  );
                }
              }
            }
          } else {
            const isValid = await this.validateRelation(
              field,
              value,
              this.projectId
            );
            if (!isValid) {
              throw new Error(
                `Relation '${field.name}' references non-existent record: ${value}`
              );
            }
          }
        }
      }
    }

    // Add updatedAt if timestamps enabled
    if (this.schema.timestamps) {
      data.updatedAt = new Date();
    }

    // Handle many-to-many relations (store as JSON)
    const processedData: Record<string, any> = { ...data };
    for (const field of this.schema.fields) {
      if (
        field.type === FieldType.RELATION &&
        field.relation?.type === "many-to-many" &&
        processedData[field.name]
      ) {
        processedData[field.name] = JSON.stringify(processedData[field.name]);
      }
    }

    const sets = Object.keys(processedData)
      .map((key, i) => `"${key}" = $${i + 2}`)
      .join(", ");
    const values = [id, ...Object.values(processedData)];

    const sql = `
      UPDATE "${this.tableName}"
      SET ${sets}
      WHERE "id" = $1
      RETURNING *;
    `;

    const result = await this.prisma.$queryRawUnsafe(sql, ...values);
    const updated = (result as any[])[0];

    // Parse JSON for many-to-many relations
    for (const field of this.schema.fields) {
      if (
        field.type === FieldType.RELATION &&
        field.relation?.type === "many-to-many" &&
        updated[field.name]
      ) {
        try {
          updated[field.name] = JSON.parse(updated[field.name]);
        } catch {
          // Keep as is
        }
      }
    }

    return updated;
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

  /**
   * Build search clause with full-text search support
   * Falls back to ILIKE if full-text search is not available
   */
  private buildSearchClause(
    searchTerm: string,
    whereValues: any[]
  ): string | null {
    if (!searchTerm || !searchTerm.trim()) {
      return null;
    }

    const trimmedSearch = searchTerm.trim();
    const searchPattern = `%${trimmedSearch}%`;

    // Get all searchable fields
    const searchableFields = this.schema.fields.filter(
      (field) =>
        field.type === FieldType.STRING ||
        field.type === FieldType.TEXT ||
        field.type === FieldType.EMAIL ||
        field.type === FieldType.URL
    );

    if (searchableFields.length === 0) {
      return null;
    }

    // For PostgreSQL, use ILIKE for case-insensitive search
    // For MySQL, would use LIKE with LOWER()
    const searchConditions = searchableFields.map((field) => {
      whereValues.push(searchPattern);
      return `"${field.name}"::text ILIKE $${whereValues.length}`;
    });

    return `(${searchConditions.join(" OR ")})`;
  }

  /**
   * Aggregate data with grouping and functions
   */
  async aggregate(params: {
    filter?: Record<string, any>;
    groupBy?: string | string[];
    functions?: {
      sum?: string | string[];
      avg?: string | string[];
      min?: string | string[];
      max?: string | string[];
      count?: string | string[];
    };
  }): Promise<any[]> {
    await this.ensureTableExists();

    const { filter = {}, groupBy, functions = {} } = params;

    // Build WHERE clause
    let whereClause = "";
    const whereValues: any[] = [];

    if (this.schema.softDelete) {
      whereClause = 'WHERE "deletedAt" IS NULL';
    }

    if (filter && Object.keys(filter).length > 0) {
      const filterConditions = this.buildWhereClauseFromFilter(
        filter,
        whereValues
      );

      if (filterConditions) {
        if (whereClause) {
          whereClause += " AND " + filterConditions;
        } else {
          whereClause = "WHERE " + filterConditions;
        }
      }
    }

    // Build SELECT clause with aggregation functions
    const selectParts: string[] = [];

    // Add GROUP BY fields
    if (groupBy) {
      const groupFields = Array.isArray(groupBy) ? groupBy : [groupBy];
      for (const field of groupFields) {
        // Validate field exists
        if (
          field === "id" ||
          this.schema.fields.some((f) => f.name === field) ||
          field.startsWith("createdAt") ||
          field.startsWith("updatedAt")
        ) {
          selectParts.push(`"${field}"`);
        }
      }
    }

    // Add aggregation functions
    const functionMap: Record<string, string> = {
      sum: "SUM",
      avg: "AVG",
      min: "MIN",
      max: "MAX",
      count: "COUNT",
    };

    for (const [funcName, funcSQL] of Object.entries(functionMap)) {
      const fields = functions[funcName as keyof typeof functions];
      if (fields) {
        const fieldList = Array.isArray(fields) ? fields : [fields];
        for (const field of fieldList) {
          // Validate field is numeric for sum/avg/min/max
          const fieldDef = this.schema.fields.find((f) => f.name === field);
          if (fieldDef) {
            if (
              funcName === "sum" ||
              funcName === "avg" ||
              funcName === "min" ||
              funcName === "max"
            ) {
              if (fieldDef.type !== FieldType.NUMBER) {
                throw new Error(
                  `Field '${field}' must be of type 'number' for ${funcName}`
                );
              }
            }

            if (funcName === "count") {
              selectParts.push(`${funcSQL}(*) as "${field}_count"`);
            } else {
              selectParts.push(
                `${funcSQL}("${field}") as "${field}_${funcName}"`
              );
            }
          }
        }
      }
    }

    // If no functions specified, just count
    if (selectParts.length === 0) {
      selectParts.push('COUNT(*) as "count"');
    }

    const selectClause = selectParts.join(", ");

    // Build GROUP BY clause
    let groupByClause = "";
    if (groupBy) {
      const groupFields = Array.isArray(groupBy) ? groupBy : [groupBy];
      const validGroupFields = groupFields
        .map((f) => `"${f}"`)
        .filter((f) => {
          const fieldName = f.replace(/"/g, "");
          return (
            fieldName === "id" ||
            this.schema.fields.some((field) => field.name === fieldName) ||
            fieldName.startsWith("createdAt") ||
            fieldName.startsWith("updatedAt")
          );
        });

      if (validGroupFields.length > 0) {
        groupByClause = `GROUP BY ${validGroupFields.join(", ")}`;
      }
    }

    const sql = `
      SELECT ${selectClause}
      FROM "${this.tableName}"
      ${whereClause}
      ${groupByClause}
      ORDER BY ${
        groupBy ? `"${Array.isArray(groupBy) ? groupBy[0] : groupBy}"` : "1"
      };
    `;

    const result = await this.prisma.$queryRawUnsafe(sql, ...whereValues);
    return result as any[];
  }

  /**
   * Get statistics for collection
   */
  async getStats(filter?: Record<string, any>): Promise<{
    total: number;
    byField?: Record<string, Record<string, number>>;
    dateRange?: { min: string | null; max: string | null };
  }> {
    await this.ensureTableExists();

    // Build WHERE clause
    let whereClause = "";
    const whereValues: any[] = [];

    if (this.schema.softDelete) {
      whereClause = 'WHERE "deletedAt" IS NULL';
    }

    if (filter && Object.keys(filter).length > 0) {
      const filterConditions = this.buildWhereClauseFromFilter(
        filter,
        whereValues
      );

      if (filterConditions) {
        if (whereClause) {
          whereClause += " AND " + filterConditions;
        } else {
          whereClause = "WHERE " + filterConditions;
        }
      }
    }

    // Get total count
    const countSql = `SELECT COUNT(*) FROM "${this.tableName}" ${whereClause};`;
    const countResult = await this.prisma.$queryRawUnsafe(
      countSql,
      ...whereValues
    );
    const total = parseInt((countResult as any[])[0].count);

    // Get stats by enum/boolean fields
    const byField: Record<string, Record<string, number>> = {};

    for (const field of this.schema.fields) {
      if (field.validation?.enum || field.type === FieldType.BOOLEAN) {
        try {
          const statsSql = `
            SELECT "${field.name}", COUNT(*) as count
            FROM "${this.tableName}"
            ${whereClause}
            GROUP BY "${field.name}"
            ORDER BY count DESC;
          `;
          const statsResult = await this.prisma.$queryRawUnsafe(
            statsSql,
            ...whereValues
          );

          byField[field.name] = {};
          (statsResult as any[]).forEach((row) => {
            byField[field.name][row[field.name]?.toString() || "null"] =
              parseInt(row.count);
          });
        } catch (err) {
          // Skip if field doesn't exist or error
        }
      }
    }

    // Get date range if timestamps enabled
    let dateRange: { min: string | null; max: string | null } | undefined;
    if (this.schema.timestamps) {
      try {
        const dateSql = `
          SELECT 
            MIN("createdAt") as min_date,
            MAX("createdAt") as max_date
          FROM "${this.tableName}"
          ${whereClause};
        `;
        const dateResult = await this.prisma.$queryRawUnsafe(
          dateSql,
          ...whereValues
        );
        const dateRow = (dateResult as any[])[0];
        if (dateRow) {
          dateRange = {
            min: dateRow.min_date
              ? new Date(dateRow.min_date).toISOString()
              : null,
            max: dateRow.max_date
              ? new Date(dateRow.max_date).toISOString()
              : null,
          };
        }
      } catch (err) {
        // Skip if error
      }
    }

    return {
      total,
      byField: Object.keys(byField).length > 0 ? byField : undefined,
      dateRange,
    };
  }

  /**
   * ========================================
   * TRANSACTION SUPPORT
   * ========================================
   */

  /**
   * Execute multiple operations in a transaction
   * All operations will succeed or all will fail (atomic)
   */
  async executeTransaction<T>(
    operations: ((prisma: PrismaClient) => Promise<any>)[]
  ): Promise<T[]> {
    return await this.prisma.$transaction(operations.map((op) => op(this.prisma)));
  }

  /**
   * Insert multiple records in a transaction
   */
  async insertTransaction(dataArray: Record<string, any>[]): Promise<any[]> {
    await this.ensureTableExists();

    const operations = dataArray.map((data) => {
      return this.buildInsertOperation(data);
    });

    return await this.prisma.$transaction(operations);
  }

  /**
   * Update multiple records in a transaction
   */
  async updateTransaction(
    updates: Array<{ id: string; data: Record<string, any> }>
  ): Promise<any[]> {
    await this.ensureTableExists();

    const operations = updates.map(({ id, data }) => {
      return this.buildUpdateOperation(id, data);
    });

    return await this.prisma.$transaction(operations);
  }

  /**
   * Delete multiple records in a transaction
   */
  async deleteTransaction(ids: string[]): Promise<number> {
    await this.ensureTableExists();

    const operations = ids.map((id) => {
      return this.buildDeleteOperation(id);
    });

    await this.prisma.$transaction(operations);
    return ids.length;
  }

  /**
   * Build insert operation (for transactions)
   */
  private buildInsertOperation(data: Record<string, any>) {
    const { id, ...dataWithoutId } = data;
    const convertedData = this.convertDataTypes(dataWithoutId);

    const validation = this.validateData(convertedData);
    if (!validation.valid) {
      throw new Error(`Validation failed: ${validation.errors.join(", ")}`);
    }

    if (this.schema.timestamps) {
      convertedData.createdAt = new Date();
      convertedData.updatedAt = new Date();
    }

    const processedData: Record<string, any> = { ...convertedData };

    for (const field of this.schema.fields) {
      if (field.type === FieldType.RELATION && field.relation?.type === "many-to-many") {
        const value = processedData[field.name];
        if (Array.isArray(value)) {
          processedData[field.name] = JSON.stringify(value);
        }
      }
    }

    const columns = Object.keys(processedData)
      .map((key) => `"${key}"`)
      .join(", ");
    const placeholders = Object.keys(processedData)
      .map((_, i) => `$${i + 1}`)
      .join(", ");
    const values = Object.values(processedData);

    const sql = `
      INSERT INTO "${this.tableName}" (${columns})
      VALUES (${placeholders})
      RETURNING *;
    `;

    return this.prisma.$queryRawUnsafe(sql, ...values);
  }

  /**
   * Build update operation (for transactions)
   */
  private buildUpdateOperation(id: string, data: Record<string, any>) {
    const convertedData = this.convertDataTypes(data);

    if (this.schema.timestamps) {
      convertedData.updatedAt = new Date();
    }

    const processedData: Record<string, any> = { ...convertedData };

    for (const field of this.schema.fields) {
      if (field.type === FieldType.RELATION && field.relation?.type === "many-to-many") {
        const value = processedData[field.name];
        if (value !== undefined && Array.isArray(value)) {
          processedData[field.name] = JSON.stringify(value);
        }
      }
    }

    const updates = Object.keys(processedData)
      .map((key, i) => `"${key}" = $${i + 2}`)
      .join(", ");
    const values = [id, ...Object.values(processedData)];

    const sql = `
      UPDATE "${this.tableName}"
      SET ${updates}
      WHERE "id" = $1
      RETURNING *;
    `;

    return this.prisma.$queryRawUnsafe(sql, ...values);
  }

  /**
   * Build delete operation (for transactions)
   */
  private buildDeleteOperation(id: string) {
    if (this.schema.softDelete) {
      const sql = `
        UPDATE "${this.tableName}"
        SET "deletedAt" = $2
        WHERE "id" = $1;
      `;
      return this.prisma.$queryRawUnsafe(sql, id, new Date());
    } else {
      const sql = `
        DELETE FROM "${this.tableName}"
        WHERE "id" = $1;
      `;
      return this.prisma.$queryRawUnsafe(sql, id);
    }
  }

  /**
   * Execute custom SQL in transaction
   * CAUTION: Use with care, ensure SQL is safe from injection
   */
  async executeRawTransaction(queries: Array<{ sql: string; params: any[] }>) {
    const operations = queries.map(({ sql, params }) => {
      return this.prisma.$queryRawUnsafe(sql, ...params);
    });

    return await this.prisma.$transaction(operations);
  }

  /**
   * Get Prisma client instance (for advanced usage)
   */
  getPrismaClient(): PrismaClient {
    return this.prisma;
  }
}

