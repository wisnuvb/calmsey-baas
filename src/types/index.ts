import { FastifyRequest } from 'fastify';

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
  STRING = 'string',
  TEXT = 'text',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  DATETIME = 'datetime',
  EMAIL = 'email',
  URL = 'url',
  JSON = 'json',
  RELATION = 'relation',
  FILE = 'file',
}

// Field definition in schema
export interface FieldDefinition {
  name: string;
  type: FieldType;
  required?: boolean;
  unique?: boolean;
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
    type: 'one-to-one' | 'one-to-many' | 'many-to-many';
  };
}

// Collection schema structure
export interface CollectionSchema {
  fields: FieldDefinition[];
  timestamps?: boolean; // auto-add createdAt, updatedAt
  softDelete?: boolean; // auto-add deletedAt
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

// Query parameters for list endpoints
export interface QueryParams {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  search?: string;
  filter?: Record<string, any>;
}
