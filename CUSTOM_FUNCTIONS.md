# Custom Functions - Calmsey BaaS

Complete documentation for the Custom Functions (Serverless Functions) feature in Calmsey BaaS.

## 📋 Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Function Context](#function-context)
4. [Examples](#examples)
5. [API Reference](#api-reference)
6. [Best Practices](#best-practices)
7. [Limitations](#limitations)

---

## Overview

Custom Functions allow you to write and deploy serverless functions with TypeScript/JavaScript that run on Calmsey BaaS servers. These functions can:

- ✅ Access your project database via Prisma
- ✅ Receive HTTP requests (GET/POST)
- ✅ Run custom business logic
- ✅ Use environment variables
- ✅ Auto-scaling and monitoring

### Use Cases

- **Custom API Endpoints**: Create endpoints with complex logic
- **Data Processing**: Transform or validate data before saving
- **Integrations**: Connect with third-party APIs
- **Scheduled Tasks**: Run cron jobs (coming soon)
- **Webhooks**: Handle webhooks from external services

---

## Quick Start

### 1. Create Function via Dashboard

1. Login to dashboard
2. Select project
3. Navigate to **Functions** → **+ New Function**
4. Fill the form:
   - **Name**: my-first-function
   - **Description**: My first serverless function
   - **Status**: Active
5. Write your code (examples are provided)
6. Click **Create Function**

### 2. Create Function via API

```bash
curl -X POST http://localhost:3000/api/functions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "hello-world",
    "projectId": "YOUR_PROJECT_ID",
    "sourceCode": "export async function handler(context) { return { message: \"Hello World!\" }; }",
    "status": "ACTIVE"
  }'
```

### 3. Invoke Function

```bash
curl -X POST http://localhost:3000/api/invoke/YOUR_PROJECT_SLUG/hello-world \
  -H "X-API-Key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name": "John"}'
```

---

## Function Context

Setiap function menerima `context` object dengan properties berikut:

### `context.prisma`

Prisma client yang sudah di-scope ke project Anda. Gunakan untuk query database.

```typescript
// Query raw SQL
const users = await context.prisma.$queryRaw`
  SELECT * FROM "data_${context.project.id}_users"
  LIMIT 10
`;

// Execute raw SQL
await context.prisma.$executeRaw`
  UPDATE "data_${context.project.id}_products"
  SET stock = stock - 1
  WHERE id = ${productId}
`;
```

### `context.request`

Request data dari client:

```typescript
interface Request {
  body: any; // Request body (parsed JSON)
  headers: Record<string, string>; // HTTP headers
  method: string; // HTTP method (GET, POST, etc)
  query: Record<string, string>; // Query parameters
  params: Record<string, string>; // URL parameters
}
```

**Example:**

```typescript
export async function handler(context) {
  const { body, query, headers } = context.request;

  console.log("Body:", body);
  console.log("Query:", query);
  console.log("User-Agent:", headers["user-agent"]);

  return { received: body };
}
```

### `context.project`

Project information:

```typescript
interface Project {
  id: string; // Project ID
  slug: string; // Project slug
}
```

### `context.env`

Environment variables (set via dashboard):

```typescript
const apiKey = context.env.EXTERNAL_API_KEY;
const secret = context.env.SECRET_TOKEN;
```

### `context.log()` & `context.error()`

Logging functions (output akan tersimpan di logs):

```typescript
context.log("Processing user:", userId);
context.error("Failed to process:", error);
```

---

## Examples

### Example 1: Simple Hello World

```typescript
export async function handler(context) {
  const { name } = context.request.body;

  return {
    success: true,
    message: `Hello, ${name || "World"}!`,
    timestamp: new Date().toISOString(),
  };
}
```

**Invoke:**

```bash
curl -X POST http://localhost:3000/api/invoke/my-project/hello-world \
  -H "X-API-Key: sk_xxx" \
  -d '{"name": "John"}'
```

**Response:**

```json
{
  "success": true,
  "data": {
    "success": true,
    "message": "Hello, John!",
    "timestamp": "2024-01-15T10:00:00.000Z"
  },
  "meta": {
    "duration": 45,
    "logs": ["[LOG] Processing request: { name: 'John' }"]
  }
}
```

---

### Example 2: Database Query

```typescript
export async function handler(context) {
  const { prisma, project, log } = context;

  log("Fetching users from database");

  // Query users table
  const users = await prisma.$queryRaw`
    SELECT id, name, email, "createdAt"
    FROM "data_${project.id}_users"
    ORDER BY "createdAt" DESC
    LIMIT 10
  `;

  log(`Found ${users.length} users`);

  return {
    success: true,
    data: users,
    count: users.length,
  };
}
```

---

### Example 3: Create Record

```typescript
export async function handler(context) {
  const { prisma, project, request, log } = context;
  const { name, email, age } = request.body;

  // Validate input
  if (!name || !email) {
    return {
      success: false,
      error: "Name and email are required",
    };
  }

  log("Creating new user:", { name, email });

  // Insert user
  const result = await prisma.$queryRaw`
    INSERT INTO "data_${project.id}_users" (id, name, email, age, "createdAt", "updatedAt")
    VALUES (gen_random_uuid(), ${name}, ${email}, ${age}, NOW(), NOW())
    RETURNING *
  `;

  return {
    success: true,
    data: result[0],
    message: "User created successfully",
  };
}
```

---

### Example 4: External API Integration

```typescript
export async function handler(context) {
  const { env, log, error } = context;
  const { city } = context.request.query;

  try {
    log("Fetching weather for:", city);

    // Call external API
    const response = await fetch(
      `https://api.weatherapi.com/v1/current.json?key=${env.WEATHER_API_KEY}&q=${city}`
    );

    if (!response.ok) {
      throw new Error(`Weather API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      success: true,
      data: {
        city: data.location.name,
        temperature: data.current.temp_c,
        condition: data.current.condition.text,
      },
    };
  } catch (err) {
    error("Failed to fetch weather:", err.message);

    return {
      success: false,
      error: err.message,
    };
  }
}
```

---

### Example 5: Complex Business Logic

```typescript
export async function handler(context) {
  const { prisma, project, request, log } = context;
  const { userId, productId, quantity } = request.body;

  log("Processing order for user:", userId);

  try {
    // 1. Check product stock
    const product = await prisma.$queryRaw`
      SELECT id, name, price, stock
      FROM "data_${project.id}_products"
      WHERE id = ${productId}
    `;

    if (!product || product.length === 0) {
      return { success: false, error: "Product not found" };
    }

    if (product[0].stock < quantity) {
      return { success: false, error: "Insufficient stock" };
    }

    // 2. Calculate total
    const total = product[0].price * quantity;

    // 3. Create order (in transaction)
    await prisma.$executeRaw`
      BEGIN;
      
      -- Create order
      INSERT INTO "data_${project.id}_orders" (id, "userId", "productId", quantity, total, status, "createdAt")
      VALUES (gen_random_uuid(), ${userId}, ${productId}, ${quantity}, ${total}, 'pending', NOW());
      
      -- Reduce stock
      UPDATE "data_${project.id}_products"
      SET stock = stock - ${quantity}
      WHERE id = ${productId};
      
      COMMIT;
    `;

    log("Order created successfully");

    return {
      success: true,
      message: "Order placed successfully",
      data: {
        productName: product[0].name,
        quantity,
        total,
      },
    };
  } catch (err) {
    log("Order failed:", err.message);

    return {
      success: false,
      error: "Failed to process order",
    };
  }
}
```

---

## API Reference

### Management API (JWT Required)

#### List Functions

```http
GET /api/functions?projectId={projectId}&status={status}
Authorization: Bearer {jwt_token}
```

#### Get Function

```http
GET /api/functions/{functionId}
Authorization: Bearer {jwt_token}
```

#### Create Function

```http
POST /api/functions
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "my-function",
  "projectId": "proj_123",
  "description": "My custom function",
  "sourceCode": "export async function handler(context) { ... }",
  "entrypoint": "handler",
  "timeout": 30000,
  "memory": 256,
  "envVars": {
    "API_KEY": "secret"
  },
  "status": "ACTIVE"
}
```

#### Update Function

```http
PATCH /api/functions/{functionId}
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "updated-name",
  "sourceCode": "...",
  "status": "ACTIVE"
}
```

#### Delete Function

```http
DELETE /api/functions/{functionId}
Authorization: Bearer {jwt_token}
```

#### Get Function Logs

```http
GET /api/functions/{functionId}/logs?page=1&limit=50&status=ERROR
Authorization: Bearer {jwt_token}
```

#### Validate Code

```http
POST /api/functions/validate
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "sourceCode": "export async function handler(context) { ... }"
}
```

---

### Invocation API (API Key Required)

#### Invoke Function (POST)

```http
POST /api/invoke/{projectSlug}/{functionSlug}
X-API-Key: {api_key}
Content-Type: application/json

{
  "key": "value"
}
```

#### Invoke Function (GET)

```http
GET /api/invoke/{projectSlug}/{functionSlug}?param1=value1&param2=value2
X-API-Key: {api_key}
```

---

## Best Practices

### 1. Error Handling

Selalu handle errors dengan graceful:

```typescript
export async function handler(context) {
  try {
    // Your code here
    return { success: true, data: result };
  } catch (error) {
    context.error("Error occurred:", error.message);
    return {
      success: false,
      error: error.message,
    };
  }
}
```

### 2. Input Validation

Validate semua input dari user:

```typescript
export async function handler(context) {
  const { email, name } = context.request.body;

  if (!email || !email.includes("@")) {
    return { success: false, error: "Invalid email" };
  }

  if (!name || name.length < 2) {
    return { success: false, error: "Name too short" };
  }

  // Process...
}
```

### 3. Use Logging

Log important events untuk debugging:

```typescript
export async function handler(context) {
  context.log("Function started");
  context.log("Processing user:", userId);

  // ... code ...

  context.log("Function completed successfully");
  return result;
}
```

### 4. Keep Functions Small

Satu function = satu responsibility. Jangan buat function yang terlalu besar.

### 5. Use Environment Variables

Jangan hardcode secrets di code:

```typescript
// ❌ BAD
const apiKey = "sk_live_abc123";

// ✅ GOOD
const apiKey = context.env.API_KEY;
```

### 6. Return Consistent Format

Gunakan format response yang konsisten:

```typescript
// Success
return {
  success: true,
  data: result,
  message: "Operation successful",
};

// Error
return {
  success: false,
  error: "Error message",
  code: "ERROR_CODE",
};
```

---

## Limitations

### Current Limitations (Phase 1 MVP)

1. **Dependencies**: Hanya built-in Node.js modules + Prisma
2. **Timeout**: Max 30 seconds (configurable up to 5 minutes)
3. **Memory**: Max 256MB (configurable up to 2GB)
4. **Concurrent Executions**: Shared resources
5. **Cold Start**: ~50-200ms untuk first invocation
6. **No File System**: Tidak bisa write ke disk
7. **Single Version**: Belum support versioning/rollback

### Coming in Phase 2

- ✅ npm dependencies support
- ✅ Advanced sandboxing (vm2)
- ✅ Function versioning
- ✅ Async/background execution
- ✅ Scheduled triggers (cron)
- ✅ Event triggers (webhooks, database events)
- ✅ Better monitoring & metrics

---

## Troubleshooting

### Function Timeout

**Problem**: Function melebihi timeout limit

**Solution**:

- Increase timeout di function settings
- Optimize query performance
- Use pagination untuk large datasets
- Consider async processing untuk long tasks

### Memory Exceeded

**Problem**: Function menggunakan terlalu banyak memory

**Solution**:

- Process data in chunks
- Avoid loading large datasets sekaligus
- Use streaming untuk large files
- Increase memory limit

### Compilation Error

**Problem**: TypeScript compilation gagal

**Solution**:

- Check syntax errors
- Use valid TypeScript
- Avoid unsupported features
- Test dengan "Validate Code" button

### Database Connection Error

**Problem**: Tidak bisa connect ke database

**Solution**:

- Check project ID benar
- Verify table names (format: `data_{projectId}_{collection}`)
- Use parameterized queries
- Check database permissions

---

## Support

Butuh bantuan?

- 📚 [Main Documentation](./README.md)
- 📖 [API Docs](http://localhost:3000/docs)
- 💬 Email: wisnuvb@gmail.com
- 🐛 [Report Issues](https://github.com/wisnuvb/calmsey-baas/issues)

---

**Happy Coding! 🚀**
