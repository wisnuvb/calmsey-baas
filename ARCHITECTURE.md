# Technical Architecture - Calmsey BaaS

Dokumentasi mendalam tentang arsitektur teknis dan design decisions.

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Flow](#data-flow)
3. [Database Design](#database-design)
4. [Dynamic Query System](#dynamic-query-system)
5. [Authentication & Authorization](#authentication--authorization)
6. [Design Decisions](#design-decisions)
7. [Scalability Considerations](#scalability-considerations)

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                         │
│  - Web Apps, Mobile Apps, Third-party Services             │
└────────────────┬───────────────────────────┬────────────────┘
                 │                           │
         ┌───────▼──────┐           ┌───────▼──────┐
         │  JWT Token   │           │   API Key    │
         │  (Admin API) │           │  (Data API)  │
         └───────┬──────┘           └───────┬──────┘
                 │                           │
┌────────────────┴───────────────────────────┴────────────────┐
│                     API Gateway (Fastify)                    │
│  - Request validation                                        │
│  - Authentication middleware                                 │
│  - Route handling                                            │
└────────────────┬────────────────────────────────────────────┘
                 │
    ┌────────────┴───────────┐
    │                        │
┌───▼──────────┐    ┌───────▼──────────┐
│ Management   │    │  Dynamic API     │
│ API Layer    │    │  Engine          │
│              │    │                  │
│ - Users      │    │ - Query Builder  │
│ - Projects   │    │ - Validator      │
│ - Collections│    │ - CRUD Generator │
└───┬──────────┘    └───────┬──────────┘
    │                       │
    └───────────┬───────────┘
                │
┌───────────────▼────────────────┐
│      Data Access Layer         │
│  - Prisma ORM                  │
│  - Raw SQL for dynamic tables  │
└───────────────┬────────────────┘
                │
┌───────────────▼────────────────┐
│         Database               │
│  - Core tables (Prisma)        │
│  - Dynamic tables (per project)│
└────────────────────────────────┘
```

### Component Breakdown

#### 1. API Gateway (Fastify)

- **Purpose**: Handle HTTP requests, routing, middleware
- **Responsibilities**:
  - Request/response handling
  - CORS management
  - Body parsing
  - Multipart file handling
  - Error handling

#### 2. Authentication Layer

- **JWT Middleware**: For management API
- **API Key Middleware**: For dynamic data API
- **Responsibilities**:
  - Token verification
  - User identity extraction
  - Project access validation

#### 3. Management API Layer

- **Routes**:
  - Auth routes (register, login)
  - Project routes (CRUD)
  - Collection routes (schema management)
  - Upload routes (file handling)

#### 4. Dynamic API Engine

- **Query Builder**: Generate SQL from schema
- **Validator**: Validate data against schema
- **CRUD Generator**: Auto-generate endpoints

#### 5. Data Access Layer

- **Prisma**: For core tables
- **Raw SQL**: For dynamic tables
- Connection pooling
- Transaction support

---

## Data Flow

### 1. Creating a Dynamic API

```
User Request
    │
    ▼
POST /api/collections?projectId=xxx
    │
    ▼
[Auth Middleware] → Verify JWT
    │
    ▼
[Collection Route Handler]
    │
    ├─→ Validate schema with Zod
    │
    ├─→ Generate unique slug
    │
    ├─→ Add default fields (timestamps, etc)
    │
    └─→ Save to Collections table
            │
            ▼
        Response with collection metadata
```

### 2. Using Dynamic API

```
Client Request
    │
    ▼
GET /api/data/:projectSlug/:collectionSlug
    │
    ▼
[API Key Middleware]
    │
    ├─→ Validate API key
    │
    ├─→ Load project from key
    │
    └─→ Attach project to request
        │
        ▼
[Dynamic API Handler]
    │
    ├─→ Load collection schema
    │
    ├─→ Verify project slug matches
    │
    └─→ Initialize DynamicQueryBuilder
            │
            ├─→ Ensure table exists
            │
            ├─→ Parse query params
            │
            ├─→ Build SQL query
            │
            ├─→ Execute query
            │
            └─→ Return results
```

### 3. Creating Data

```
Client Request
    │
    ▼
POST /api/data/:projectSlug/:collectionSlug
    │
    ▼
[API Key Middleware] → Validate & load project
    │
    ▼
[Dynamic API Handler]
    │
    ├─→ Load collection schema
    │
    └─→ Initialize DynamicQueryBuilder
            │
            ├─→ Validate request body against schema
            │   ├─→ Check required fields
            │   ├─→ Validate types
            │   ├─→ Check constraints (min/max, enum, etc)
            │   └─→ Check unique fields
            │
            ├─→ Add auto fields (timestamps)
            │
            ├─→ Build INSERT query
            │
            ├─→ Execute with prepared statement
            │
            └─→ Return created record
```

---

## Database Design

### Core Tables (Prisma Managed)

#### Users Table

```sql
CREATE TABLE "User" (
  id         VARCHAR PRIMARY KEY,
  email      VARCHAR UNIQUE NOT NULL,
  password   VARCHAR NOT NULL,
  name       VARCHAR,
  role       VARCHAR DEFAULT 'USER',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Projects Table

```sql
CREATE TABLE "Project" (
  id          VARCHAR PRIMARY KEY,
  name        VARCHAR NOT NULL,
  slug        VARCHAR UNIQUE NOT NULL,
  description TEXT,
  database    VARCHAR,
  user_id     VARCHAR REFERENCES "User"(id),
  created_at  TIMESTAMP DEFAULT NOW(),
  updated_at  TIMESTAMP DEFAULT NOW()
);
```

#### Collections Table

```sql
CREATE TABLE "Collection" (
  id         VARCHAR PRIMARY KEY,
  name       VARCHAR NOT NULL,
  slug       VARCHAR NOT NULL,
  schema     JSONB NOT NULL,
  project_id VARCHAR REFERENCES "Project"(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(project_id, slug)
);
```

### Dynamic Tables (Auto-generated)

**Naming Convention**: `data_{projectId}_{collectionSlug}`

**Example**: For project `abc-123` with collection `products`:

```sql
CREATE TABLE "data_abc_123_products" (
  id           VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name         VARCHAR(255) NOT NULL,
  price        NUMERIC NOT NULL,
  stock        NUMERIC DEFAULT 0,
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMP DEFAULT NOW(),
  updated_at   TIMESTAMP DEFAULT NOW()
);

-- Indexes for unique fields
CREATE UNIQUE INDEX idx_name_unique ON "data_abc_123_products"(name);
```

---

## Dynamic Query System

### Schema to SQL Mapping

#### Type Mapping

```typescript
FieldType.STRING    → VARCHAR(255)
FieldType.TEXT      → TEXT
FieldType.NUMBER    → NUMERIC
FieldType.BOOLEAN   → BOOLEAN
FieldType.DATE      → DATE
FieldType.DATETIME  → TIMESTAMP
FieldType.EMAIL     → VARCHAR(255)
FieldType.URL       → VARCHAR(500)
FieldType.JSON      → JSONB
FieldType.FILE      → VARCHAR(500)
```

#### Constraint Mapping

```typescript
required: true      → NOT NULL
unique: true        → UNIQUE INDEX
default: value      → DEFAULT value
```

### Query Building Process

#### 1. Table Creation

```typescript
// Schema input
{
  fields: [
    { name: "title", type: "string", required: true },
    { name: "price", type: "number", required: true }
  ],
  timestamps: true
}

// Generated SQL
CREATE TABLE "data_project_collection" (
  id VARCHAR PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  price NUMERIC NOT NULL,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

#### 2. Insert Query

```typescript
// Input data
{ title: "Product", price: 99.99 }

// Validation
✓ title is string (required)
✓ price is number (required)

// Add timestamps
{ title: "Product", price: 99.99, createdAt: now, updatedAt: now }

// Generated SQL (parameterized)
INSERT INTO "data_project_collection" ("title", "price", "createdAt", "updatedAt")
VALUES ($1, $2, $3, $4)
RETURNING *;

// Parameters: ["Product", 99.99, "2024-01-15T10:00:00Z", "2024-01-15T10:00:00Z"]
```

#### 3. Select with Filters

```typescript
// Query params
{
  page: 1,
  limit: 10,
  filter: { isActive: true },
  sort: "createdAt",
  order: "desc"
}

// Generated SQL
SELECT * FROM "data_project_collection"
WHERE "isActive" = $1 AND "deletedAt" IS NULL
ORDER BY "createdAt" DESC
LIMIT 10 OFFSET 0;

// Count query
SELECT COUNT(*) FROM "data_project_collection"
WHERE "isActive" = $1 AND "deletedAt" IS NULL;
```

### Security: SQL Injection Prevention

**Always use parameterized queries:**

```typescript
// ✅ SAFE - Parameterized
await prisma.$queryRawUnsafe('SELECT * FROM "table" WHERE "id" = $1', userId);

// ❌ UNSAFE - String concatenation
await prisma.$queryRawUnsafe(`SELECT * FROM "table" WHERE "id" = '${userId}'`);
```

---

## Authentication & Authorization

### JWT Flow (Management API)

```
1. User registers/logs in
   ↓
2. Server generates JWT with payload:
   {
     id: userId,
     email: userEmail,
     role: userRole
   }
   ↓
3. Client stores token
   ↓
4. Client sends token in Authorization header:
   Authorization: Bearer {token}
   ↓
5. Middleware verifies token using secret
   ↓
6. If valid, attach user to request
   ↓
7. Continue to route handler
```

### API Key Flow (Dynamic API)

```
1. User creates project
   ↓
2. System auto-generates API key:
   sk_{32_random_chars}
   ↓
3. Key stored in database with project_id
   ↓
4. Client sends key in header:
   X-API-Key: sk_xxx
   ↓
5. Middleware looks up key in database
   ↓
6. If valid, attach project to request
   ↓
7. Update lastUsed timestamp
   ↓
8. Continue to route handler
```

### Authorization Matrix

| Endpoint            | Auth Type | Required Role | Checks        |
| ------------------- | --------- | ------------- | ------------- |
| POST /auth/register | None      | -             | -             |
| POST /auth/login    | None      | -             | -             |
| GET /auth/me        | JWT       | USER          | -             |
| POST /projects      | JWT       | USER          | -             |
| GET /projects/:id   | JWT       | USER          | Owner         |
| POST /collections   | JWT       | USER          | Project owner |
| GET /api/data/\*    | API Key   | -             | Project match |

---

## Design Decisions

### 1. Why Fastify over Express?

- **Performance**: 2x faster than Express
- **Plugin architecture**: Better for modular code
- **Built-in validation**: Schema-based validation
- **TypeScript support**: First-class TypeScript support

### 2. Why Prisma?

- **Type-safe**: Auto-generated types
- **Migration system**: Version control for database
- **Multi-database**: Easy to switch between PostgreSQL/MySQL
- **Raw SQL support**: When needed for dynamic queries

### 3. Why Raw SQL for Dynamic Tables?

- **Flexibility**: Can't use ORM for unknown schemas
- **Performance**: Direct SQL is faster
- **Control**: Full control over table structure
- **Safety**: Parameterized queries prevent injection

### 4. Why JSON for Schema Storage?

- **Flexibility**: Easy to modify without migrations
- **Validation**: Can validate at runtime
- **Portability**: Easy to export/import
- **Version control**: Schema changes tracked in collections

### 5. Table Naming: `data_{projectId}_{slug}`

- **Isolation**: Clear separation per project
- **Uniqueness**: Guaranteed unique names
- **Debugging**: Easy to identify in database
- **Cleanup**: Easy to drop all project tables

### 6. Two-layer Authentication

- **JWT for Admin**: Secure, stateless, short-lived
- **API Key for Data**: Simple, project-scoped, trackable
- **Separation**: Different access levels, different purposes

---

## Scalability Considerations

### Current Architecture Limitations

1. **Single Database**

   - All projects in one database
   - Potential bottleneck at scale

2. **No Caching**

   - Every request hits database
   - Schema loaded repeatedly

3. **Synchronous Processing**
   - File uploads block requests
   - Long queries block threads

### Scaling Strategies

#### Horizontal Scaling

```
┌─────────┐   ┌─────────┐   ┌─────────┐
│ API #1  │   │ API #2  │   │ API #3  │
└────┬────┘   └────┬────┘   └────┬────┘
     │            │            │
     └────────────┴────────────┘
                  │
         ┌────────▼────────┐
         │  Load Balancer  │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │    Database     │
         └─────────────────┘
```

#### Database Sharding

```
Project A → Database A
Project B → Database B
Project C → Database C
```

#### Caching Strategy

```
Request
   ↓
Cache Check (Redis)
   ↓
Hit? → Return cached
   ↓
Miss? → Query DB → Cache → Return
```

#### Async Processing

```
Upload Request
   ↓
Queue Job (Bull/BullMQ)
   ↓
Immediate Response (202 Accepted)
   ↓
Worker Process
   ↓
Webhook/SSE Notification
```

### Performance Optimizations

1. **Connection Pooling**

   - Prisma handles automatically
   - Configure pool size based on load

2. **Query Optimization**

   - Index frequently queried fields
   - Limit SELECT fields
   - Use prepared statements

3. **Response Caching**

   - Cache schema definitions
   - Cache API key lookups
   - Cache-Control headers

4. **Compression**
   - Gzip response bodies
   - Reduce payload size

---

## Monitoring & Observability

### Metrics to Track

1. **Request Metrics**

   - Requests per second
   - Response times (p50, p95, p99)
   - Error rates

2. **Database Metrics**

   - Query execution time
   - Connection pool usage
   - Slow queries

3. **Business Metrics**
   - Projects created
   - Collections created
   - API calls per project
   - Storage usage

### Logging Strategy

```typescript
// Structured logging
{
  level: 'info',
  timestamp: '2024-01-15T10:00:00Z',
  requestId: 'req-123',
  userId: 'user-456',
  projectId: 'proj-789',
  action: 'create_collection',
  duration: 45,
  status: 'success'
}
```

---

## Security Best Practices

### Implemented

1. ✅ Password hashing (bcrypt with salt)
2. ✅ Parameterized queries (prevent SQL injection)
3. ✅ Input validation (Zod schemas)
4. ✅ JWT with expiry
5. ✅ API key tracking

### Recommended Additions

1. ⏳ Rate limiting per IP/API key
2. ⏳ Request size limits
3. ⏳ HTTPS only in production
4. ⏳ CORS whitelist
5. ⏳ API versioning
6. ⏳ Audit logs
7. ⏳ Data encryption at rest

---

## Testing Strategy

### Unit Tests

- Validation functions
- Type conversions
- Helper utilities

### Integration Tests

- API endpoints
- Database operations
- Authentication flow

### E2E Tests

- Full user flow
- Project → Collection → Data
- File upload flow

---

## Conclusion

Arsitektur ini di-design untuk:

- ✅ **Flexibility** - Easy to extend
- ✅ **Scalability** - Can grow with load
- ✅ **Security** - Multiple layers of protection
- ✅ **Performance** - Optimized for common operations
- ✅ **Maintainability** - Clean, documented code

---

**Ready for production with proper infrastructure setup!**
