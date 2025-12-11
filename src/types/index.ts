import { FastifyRequest } from "fastify";

// Extend FastifyRequest to include user data
export interface AuthenticatedRequest extends FastifyRequest {
  user: {
    id: string;
    email: string;
    role: string;
  };
}

// Field types for dynamic schema
export enum FieldType {
  STRING = "string",
  TEXT = "text",
  NUMBER = "number",
  BOOLEAN = "boolean",
  DATE = "date",
  DATETIME = "datetime",
  EMAIL = "email",
  URL = "url",
  JSON = "json",
  RELATION = "relation",
  FILE = "file",
}

// Field definition in schema
export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
  indexed?: boolean;
  default?: any;
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    enum?: string[];
  };
  // For relations
  relation?: {
    collection: string;
    type: "one-to-one" | "one-to-many" | "many-to-many";
  };
}

// Collection schema structure
export interface CollectionSchema {
  fields: FieldDefinition[];
  timestamps?: boolean; // auto-add createdAt, updatedAt
  softDelete?: boolean; // auto-add deletedAt
  idType?: "uuid" | "autoincrement"; // ID generation type, default: 'uuid'
}

// Dynamic API response structure
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
  };
}

// Advanced filter operators
export type FilterOperator =
  | "$eq" // equals
  | "$ne" // not equals
  | "$gt" // greater than
  | "$gte" // greater than or equal
  | "$lt" // less than
  | "$lte" // less than or equal
  | "$in" // in array
  | "$nin" // not in array
  | "$like" // LIKE pattern
  | "$ilike" // ILIKE pattern (case-insensitive)
  | "$isNull" // is null
  | "$isNotNull" // is not null
  | "$between" // between two values
  | "$contains" // contains (for JSON/array fields)
  | "$startsWith" // starts with
  | "$endsWith"; // ends with

// Advanced filter structure
export interface AdvancedFilter {
  [field: string]:
    | any
    | {
        [operator in FilterOperator]?: any;
      }
    | {
        $or?: AdvancedFilter[];
        $and?: AdvancedFilter[];
        $not?: AdvancedFilter;
      };
}

// Updated QueryParams with advanced filter support
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: "asc" | "desc";
  search?: string;
  filter?: Record<string, any> | AdvancedFilter; // Support both simple and advanced
  populate?: string | string[];
  fields?: string | string[]; // Field selection
}

// Function types
export interface FunctionDefinition {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sourceCode: string;
  language: string;
  entrypoint: string;
  timeout: number;
  memory: number;
  envVars?: Record<string, string>;
  status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ERROR";
  version: number;
  invocations: number;
  lastInvoked?: Date;
  projectId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface FunctionLogEntry {
  id: string;
  functionId: string;
  status: "SUCCESS" | "ERROR" | "TIMEOUT" | "MEMORY_EXCEEDED";
  duration?: number;
  memoryUsed?: number;
  requestBody?: any;
  requestHeaders?: any;
  responseBody?: any;
  responseStatus?: number;
  error?: string;
  errorStack?: string;
  logs?: string;
  createdAt: Date;
}
