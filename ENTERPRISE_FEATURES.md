# Enterprise Features - Calmsey BaaS

Dokumentasi lengkap untuk fitur-fitur enterprise yang baru ditambahkan.

## Table of Contents

1. [Transaction Support](#transaction-support)
2. [Audit Logging](#audit-logging)
3. [Multi-Database Architecture](#multi-database-architecture)
4. [Row-Level Security](#row-level-security)
5. [Migration Guide](#migration-guide)

---

## Transaction Support

### Overview

Transaction support memungkinkan multiple operations dieksekusi secara atomic - semua berhasil atau semua gagal. Ini **critical** untuk:
- Financial operations (transfer uang, payment processing)
- Inventory management (order + reduce stock)
- Complex workflows (multi-step processes)

### Features

✅ **Atomic operations** - All or nothing execution
✅ **Rollback support** - Auto-rollback on failure
✅ **Bulk operations** - Insert, update, delete multiple records
✅ **Custom transactions** - Execute custom SQL in transaction

### Usage Examples

#### 1. Bulk Insert in Transaction

```typescript
// Insert multiple products atomically
const products = [
  { name: "Product 1", price: 100, stock: 50 },
  { name: "Product 2", price: 200, stock: 30 },
  { name: "Product 3", price: 150, stock: 40 },
];

const results = await queryBuilder.insertTransaction(products);
// All inserted or none if any fails
```

#### 2. Bulk Update in Transaction

```typescript
// Update multiple records atomically
const updates = [
  { id: "prod-1", data: { stock: 45 } },
  { id: "prod-2", data: { stock: 25 } },
  { id: "prod-3", data: { stock: 35 } },
];

await queryBuilder.updateTransaction(updates);
```

#### 3. Complex Transaction (E-commerce Order)

```typescript
// Example: Process order with inventory reduction
const transactionId = auditService.generateTransactionId();

try {
  await queryBuilder.executeTransaction([
    // 1. Create order
    (prisma) => prisma.$queryRawUnsafe(
      `INSERT INTO "data_proj_orders" (customer_id, total, status)
       VALUES ($1, $2, $3) RETURNING id`,
      customerId, total, 'pending'
    ),

    // 2. Reduce inventory
    (prisma) => prisma.$queryRawUnsafe(
      `UPDATE "data_proj_products"
       SET stock = stock - $1
       WHERE id = $2`,
      quantity, productId
    ),

    // 3. Create invoice
    (prisma) => prisma.$queryRawUnsafe(
      `INSERT INTO "data_proj_invoices" (order_id, amount)
       VALUES ($1, $2)`,
      orderId, total
    ),
  ]);

  console.log('Order processed successfully');
} catch (error) {
  console.error('Transaction failed, all rolled back:', error);
}
```

### API Endpoints

#### Bulk Operations via API

```http
POST /api/data/:projectSlug/:collectionSlug/bulk
X-API-Key: sk_your_api_key
Content-Type: application/json

{
  "action": "insert",
  "data": [
    { "name": "Item 1", "price": 100 },
    { "name": "Item 2", "price": 200 }
  ]
}
```

---

## Audit Logging

### Overview

Audit logging melacak **semua perubahan data** untuk:
- Compliance (SOX, GDPR, ISO 27001)
- Debugging (siapa ubah apa kapan)
- Security (detect unauthorized changes)
- History tracking

### Features

✅ **Auto-tracking** - Automatic logging of all CUD operations
✅ **Change history** - Complete audit trail per record
✅ **Transaction grouping** - Group related changes
✅ **Context capture** - IP, user agent, user info
✅ **Queryable logs** - Filter by user, table, action, date

### Logged Information

```typescript
{
  userId: "user-123",           // Who made the change
  userEmail: "john@example.com",
  apiKeyId: "key-456",          // Or which API key
  action: "UPDATE",             // CREATE, UPDATE, DELETE, etc
  tableName: "data_proj_products",
  recordId: "prod-789",
  oldData: { price: 100 },      // Before change
  newData: { price: 150 },      // After change
  changedFields: ["price"],     // What changed
  ipAddress: "192.168.1.1",
  userAgent: "Mozilla/5.0...",
  transactionId: "txn_123",     // Group related changes
  createdAt: "2024-01-15T10:00:00Z"
}
```

### Usage Examples

#### 1. Manual Audit Logging

```typescript
import { AuditLogService } from './lib/audit-log.service';

const auditService = new AuditLogService(prisma);

// Log a change
await auditService.log(
  projectId,
  {
    action: 'UPDATE',
    tableName: 'data_proj_products',
    recordId: 'prod-123',
    oldData: { price: 100, stock: 50 },
    newData: { price: 150, stock: 45 },
    changedFields: ['price', 'stock'],
  },
  {
    userId: user.id,
    userEmail: user.email,
    ipAddress: request.ip,
  }
);
```

#### 2. Automatic Audit Logging (Middleware)

```typescript
// In your routes file
import { autoAuditMiddleware } from './middleware/audit.middleware';

fastify.patch('/:id', {
  onRequest: [authenticateApiKey, autoAuditMiddleware],
}, async (request, reply) => {
  // Get old data
  const oldData = await queryBuilder.findOne(id);

  // Update
  const newData = await queryBuilder.update(id, request.body);

  // Auto-log the change
  await request.audit.log({
    tableName: 'data_proj_products',
    recordId: id,
    oldData,
    newData,
  });

  return newData;
});
```

#### 3. Query Audit Logs

```typescript
// Get audit logs for a project
const logs = await auditService.query({
  projectId: 'proj-123',
  page: 1,
  limit: 50,
  userId: 'user-456',        // Filter by user
  tableName: 'data_proj_products',
  action: 'UPDATE',
  startDate: new Date('2024-01-01'),
  endDate: new Date('2024-01-31'),
});

console.log(logs.data);      // Array of audit logs
console.log(logs.meta);      // Pagination info
```

#### 4. Get Record History

```typescript
// Get complete history of a record
const history = await auditService.getRecordHistory(
  projectId,
  'data_proj_products',
  'prod-123'
);

history.forEach(log => {
  console.log(`${log.createdAt}: ${log.action} by ${log.userEmail}`);
  console.log('  Changed fields:', log.changedFields);
});
```

### API Endpoints

```http
# Get audit logs
GET /api/projects/:projectId/audit-logs?
  page=1&
  limit=50&
  userId=user-123&
  tableName=data_proj_products&
  action=UPDATE&
  startDate=2024-01-01&
  endDate=2024-01-31

# Get record history
GET /api/projects/:projectId/audit-logs/:tableName/:recordId

# Get transaction details
GET /api/projects/:projectId/audit-logs/transactions/:transactionId
```

---

## Multi-Database Architecture

### Overview

Setiap project bisa punya **database terpisah** untuk:
- True tenant isolation
- Data sovereignty (region-specific databases)
- Scalability (horizontal scaling)
- Performance (dedicated resources)

### Features

✅ **Dedicated database** - Separate database per project
✅ **Same server option** - Create DB on main server
✅ **Custom server option** - Connect to external database
✅ **Auto-migration** - Initialize schema automatically
✅ **Connection pooling** - Efficient connection management
✅ **Encrypted credentials** - Secure storage

### Architecture Options

#### Option 1: Shared Database (Default)

```
Project A  ─┐
Project B  ─┼─→  Main Database
Project C  ─┘      ├── data_projA_products
                   ├── data_projB_products
                   └── data_projC_products
```

**Pros:** Simple, cost-effective
**Cons:** Less isolation, resource sharing

#### Option 2: Dedicated Database (Same Server)

```
Project A  ──→  Database A (on main server)
Project B  ──→  Database B (on main server)
Project C  ──→  Database C (on main server)
```

**Pros:** Better isolation, easier migration
**Cons:** More databases on one server

#### Option 3: Dedicated Database (Custom Server)

```
Project A  ──→  Database A (Server 1)
Project B  ──→  Database B (Server 2 - US)
Project C  ──→  Database C (Server 3 - EU)
```

**Pros:** Full isolation, geo-distribution
**Cons:** More complex, higher cost

### Usage Examples

#### 1. Create Project with Shared Database

```http
POST /api/projects
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "My Project",
  "description": "Simple project",
  "useDedicatedDb": false
}
```

#### 2. Create Project with Dedicated DB (Same Server)

```http
POST /api/projects
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "Enterprise Project",
  "description": "Project with dedicated database",
  "useDedicatedDb": true,
  "useSameServer": true
}
```

Response:
```json
{
  "success": true,
  "data": {
    "id": "proj-123",
    "name": "Enterprise Project",
    "slug": "enterprise-project",
    "useDedicatedDb": true,
    "dbStatus": "ACTIVE",
    "database": {
      "host": "localhost",
      "port": 5432,
      "name": "baas_enterprise_project_abc123",
      "status": "ACTIVE"
    }
  }
}
```

#### 3. Create Project with Custom Database Server

```http
POST /api/projects
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "name": "EU Compliance Project",
  "description": "Data must stay in EU",
  "useDedicatedDb": true,
  "useSameServer": false,
  "dbConfig": {
    "host": "eu-db-server.example.com",
    "port": 5432,
    "database": "custom_db_name",
    "username": "db_user",
    "password": "secure_password",
    "type": "postgresql"
  }
}
```

#### 4. Code Usage

```typescript
import { DatabaseManagerService } from './lib/database-manager.service';

const dbManager = new DatabaseManagerService(prisma);

// Get connection for a project (auto-detects dedicated vs shared)
const connection = await dbManager.getConnection(projectId);

// Use the connection
const data = await connection.$queryRaw`
  SELECT * FROM products
`;

// Check database status
const status = await dbManager.getDatabaseStatus(projectId);
console.log(status); // { connected: true }
```

### Security

- ✅ Connection strings **encrypted** before storage
- ✅ Passwords **encrypted** separately
- ✅ Credentials never exposed in API responses
- ✅ Secure connection pooling

---

## Row-Level Security

### Overview

Row-Level Security (RLS) memastikan users hanya bisa akses data mereka sendiri di **database level**, bukan aplikasi level.

### Benefits

✅ **Database-enforced** - Cannot bypass even with SQL injection
✅ **Multi-tenant safe** - Perfect isolation between tenants
✅ **Performance** - DB-optimized filtering
✅ **Compliance-ready** - Meets enterprise security standards

### PostgreSQL RLS (Database-Level)

```typescript
import { RowLevelSecurityService } from './lib/row-level-security.service';

const rlsService = new RowLevelSecurityService(prisma);

// 1. Enable RLS on table
await rlsService.enableRLS('data_proj_customers');

// 2. Create policy: users can only see their own data
await rlsService.createUserAccessPolicy(
  'data_proj_customers',
  'user_id'  // column name
);

// 3. Execute queries with context
await rlsService.executeWithContext(
  { userId: 'user-123' },
  async () => {
    // This query will automatically filter by user_id
    const customers = await prisma.$queryRaw`
      SELECT * FROM data_proj_customers
    `;
    return customers;
  }
);
```

### Application-Level RLS (Works for MySQL & PostgreSQL)

```typescript
// Apply RLS filter to WHERE clause
const whereClause = rlsService.applyApplicationRLS(
  'WHERE status = "active"',
  { userId: 'user-123' }
);
// Result: WHERE status = "active" AND user_id = 'user-123'
```

### Custom Policies

```typescript
// Example: Manager can see all, employees see only theirs
await rlsService.createCustomPolicy(
  'data_proj_documents',
  'manager_or_owner',
  `role = 'manager' OR user_id = current_setting('app.current_user_id')::text`
);
```

---

## Migration Guide

### Step 1: Update Prisma Schema

```bash
# Already done! Your schema now includes:
# - AuditLog model
# - Multi-database fields in Project
# - DbStatus enum
# - AuditAction enum
```

### Step 2: Generate Prisma Client & Migrate

```bash
npm run prisma:generate
npm run prisma:migrate
```

### Step 3: Update Existing Code (Optional)

#### Enable Audit Logging on Existing Routes

```typescript
// Before
fastify.post('/', async (request, reply) => {
  const result = await queryBuilder.insert(request.body);
  return result;
});

// After (with audit logging)
import { autoAuditMiddleware } from './middleware/audit.middleware';

fastify.post('/', {
  onRequest: [autoAuditMiddleware],
}, async (request, reply) => {
  const result = await queryBuilder.insert(request.body);

  // Log the operation
  await request.audit.log({
    tableName: 'data_proj_products',
    recordId: result.id,
    newData: result,
  });

  return result;
});
```

#### Use Transactions for Critical Operations

```typescript
// Before (risky - partial failure possible)
await createOrder(data);
await reduceInventory(productId, quantity);
await createInvoice(orderId);

// After (safe - all or nothing)
await queryBuilder.executeTransaction([
  (prisma) => createOrder(data),
  (prisma) => reduceInventory(productId, quantity),
  (prisma) => createInvoice(orderId),
]);
```

### Step 4: Environment Variables

Add to `.env`:

```env
# Database encryption key for multi-DB
DB_ENCRYPTION_KEY=your-super-secret-encryption-key-change-this

# Optional: Enable RLS by default
ENABLE_RLS=true
```

---

## Performance Considerations

### Transaction Performance

- ✅ Transactions are **fast** (microseconds overhead)
- ✅ Use for **critical operations only**
- ⚠️ Long transactions can **lock rows** - keep them short

### Audit Log Performance

- ✅ Logging is **async** - doesn't block operations
- ✅ Indexed by projectId, userId, timestamp
- ⚠️ Large audit tables - consider **archiving** old logs
- 💡 **Best practice:** Archive logs older than 1 year to separate table

### Multi-Database Performance

- ✅ Connection pooling prevents overhead
- ✅ Each project gets dedicated resources
- ⚠️ More connections = more memory
- 💡 **Best practice:** Set max connections per project

---

## Security Best Practices

### 1. Always Use Transactions for Financial Operations

```typescript
// ❌ BAD - Money can be lost
await deductBalance(fromAccount, amount);
await addBalance(toAccount, amount);  // If this fails, money is lost!

// ✅ GOOD - Atomic operation
await queryBuilder.executeTransaction([
  (p) => deductBalance(fromAccount, amount),
  (p) => addBalance(toAccount, amount),
]);
```

### 2. Enable Audit Logging for Sensitive Data

```typescript
// For collections with PII, financial data, etc.
const sensitiveCollections = ['customers', 'orders', 'payments', 'invoices'];

// Enable auto-audit
if (sensitiveCollections.includes(collectionSlug)) {
  fastify.addHook('onRequest', autoAuditMiddleware);
}
```

### 3. Use RLS for Multi-Tenant Applications

```typescript
// Enable RLS on all dynamic tables
await rlsService.enableRLS(tableName);
await rlsService.createProjectIsolationPolicy(tableName);
```

### 4. Encrypt Sensitive Database Credentials

```typescript
// Already done automatically by DatabaseManagerService!
// Credentials are encrypted before storage
```

---

## Troubleshooting

### Issue: Prisma Migration Fails

**Solution:**
```bash
# Reset database (DEV ONLY!)
npx prisma migrate reset

# Or manually run migration
npx prisma migrate deploy
```

### Issue: Audit Logs Not Created

**Check:**
1. Is middleware attached? `onRequest: [autoAuditMiddleware]`
2. Is project context set? `request.project` should exist
3. Check logs for errors

### Issue: Transaction Timeout

**Solution:**
```typescript
// Increase timeout
await prisma.$transaction([...], {
  timeout: 30000, // 30 seconds
});
```

### Issue: RLS Blocks All Queries

**Solution:**
```typescript
// Make sure to set context before queries
await rlsService.executeWithContext(
  { userId: 'user-123' },
  async () => {
    // Your query here
  }
);
```

---

## Conclusion

Dengan fitur-fitur enterprise ini, Calmsey BaaS sekarang **production-ready** untuk:

✅ **E-commerce platforms** (transactions + audit)
✅ **Financial applications** (transactions + compliance)
✅ **SaaS platforms** (multi-database + RLS)
✅ **Healthcare systems** (audit trail + security)
✅ **ERP systems** (transactions + audit + RLS)

**Next Steps:**
1. Run migration: `npm run prisma:migrate`
2. Update your code to use transactions
3. Enable audit logging on critical routes
4. Consider multi-database for large deployments
5. Enable RLS for enhanced security

---

## Support

Questions? Issues?
Create an issue di GitHub repository atau email: wisnuvb@gmail.com
