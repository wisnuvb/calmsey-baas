export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
  useDedicatedDb?: boolean;
  dbHost?: string | null;
  dbPort?: number | null;
  dbName?: string | null;
  dbUser?: string | null;
  dbStatus?: string;
  collections?: Collection[];
  apiKeys?: ApiKey[];
  settings?: ProjectSettings;
  _count?: {
    collections: number;
    apiKeys: number;
  };
}

export interface ProjectSettings {
  id: string;
  emailEnabled: boolean;
  emailProvider: string | null;
  emailConfig?: Record<string, any> | null;
  storageType: string;
  storageConfig?: Record<string, any> | null;
  authEnabled: boolean;
  jwtExpiry: number;
  createdAt: string;
  updatedAt: string;
}

export interface Collection {
  id: string;
  name: string;
  slug: string;
  schema: CollectionSchema;
  projectId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CollectionSchema {
  fields: FieldDefinition[];
  timestamps?: boolean;
  softDelete?: boolean;
}

export interface FieldDefinition {
  name: string;
  type: string;
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

export interface ApiKey {
  id: string;
  name: string;
  key: string;
  createdAt: string;
  lastUsed: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
}
