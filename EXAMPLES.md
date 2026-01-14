# Examples - Calmsey BaaS

Practical examples of using Calmsey BaaS for various use cases.

## Table of Contents

1. [E-commerce Backend](#1-e-commerce-backend)
2. [Blog Platform](#2-blog-platform)
3. [Todo Application](#3-todo-application)
4. [CRM System](#4-crm-system)
5. [Event Management](#5-event-management)

---

## 1. E-commerce Backend

### Schema Definitions

#### Products Collection

```json
{
  "name": "Products",
  "schema": {
    "fields": [
      {
        "name": "name",
        "type": "string",
        "required": true
      },
      {
        "name": "slug",
        "type": "string",
        "required": true,
        "unique": true
      },
      {
        "name": "description",
        "type": "text",
        "required": false
      },
      {
        "name": "price",
        "type": "number",
        "required": true,
        "validation": {
          "min": 0
        }
      },
      {
        "name": "comparePrice",
        "type": "number",
        "required": false
      },
      {
        "name": "stock",
        "type": "number",
        "required": true,
        "default": 0,
        "validation": {
          "min": 0
        }
      },
      {
        "name": "sku",
        "type": "string",
        "unique": true
      },
      {
        "name": "category",
        "type": "string",
        "required": true
      },
      {
        "name": "images",
        "type": "json"
      },
      {
        "name": "isActive",
        "type": "boolean",
        "default": true
      },
      {
        "name": "isFeatured",
        "type": "boolean",
        "default": false
      }
    ],
    "timestamps": true,
    "softDelete": false
  }
}
```

#### Categories Collection

```json
{
  "name": "Categories",
  "schema": {
    "fields": [
      {
        "name": "name",
        "type": "string",
        "required": true,
        "unique": true
      },
      {
        "name": "slug",
        "type": "string",
        "required": true,
        "unique": true
      },
      {
        "name": "description",
        "type": "text"
      },
      {
        "name": "image",
        "type": "file"
      },
      {
        "name": "isActive",
        "type": "boolean",
        "default": true
      }
    ],
    "timestamps": true
  }
}
```

#### Orders Collection

```json
{
  "name": "Orders",
  "schema": {
    "fields": [
      {
        "name": "orderNumber",
        "type": "string",
        "required": true,
        "unique": true
      },
      {
        "name": "customerEmail",
        "type": "email",
        "required": true
      },
      {
        "name": "customerName",
        "type": "string",
        "required": true
      },
      {
        "name": "items",
        "type": "json",
        "required": true
      },
      {
        "name": "subtotal",
        "type": "number",
        "required": true
      },
      {
        "name": "tax",
        "type": "number",
        "default": 0
      },
      {
        "name": "shipping",
        "type": "number",
        "default": 0
      },
      {
        "name": "total",
        "type": "number",
        "required": true
      },
      {
        "name": "status",
        "type": "string",
        "required": true,
        "default": "pending",
        "validation": {
          "enum": ["pending", "processing", "shipped", "delivered", "cancelled"]
        }
      },
      {
        "name": "shippingAddress",
        "type": "json",
        "required": true
      },
      {
        "name": "notes",
        "type": "text"
      }
    ],
    "timestamps": true
  }
}
```

### Example Usage

```bash
# Create product
curl -X POST http://localhost:3000/api/data/my-shop/products \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_xxx" \
  -d '{
    "name": "Premium Headphones",
    "slug": "premium-headphones",
    "description": "High-quality wireless headphones",
    "price": 299.99,
    "comparePrice": 399.99,
    "stock": 50,
    "sku": "HEAD-001",
    "category": "electronics",
    "images": [
      "/uploads/headphone-1.jpg",
      "/uploads/headphone-2.jpg"
    ],
    "isActive": true,
    "isFeatured": true
  }'

# Get products with filtering
curl "http://localhost:3000/api/data/my-shop/products?filter={\"category\":\"electronics\",\"isActive\":true}&page=1&limit=20" \
  -H "X-API-Key: sk_xxx"

# Create order
curl -X POST http://localhost:3000/api/data/my-shop/orders \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_xxx" \
  -d '{
    "orderNumber": "ORD-2024-001",
    "customerEmail": "customer@example.com",
    "customerName": "John Doe",
    "items": [
      {
        "productId": "prod-123",
        "name": "Premium Headphones",
        "quantity": 1,
        "price": 299.99
      }
    ],
    "subtotal": 299.99,
    "tax": 29.99,
    "shipping": 10,
    "total": 339.98,
    "status": "pending",
    "shippingAddress": {
      "street": "123 Main St",
      "city": "New York",
      "state": "NY",
      "zip": "10001"
    }
  }'
```

---

## 2. Blog Platform

### Schema Definitions

#### Posts Collection

```json
{
  "name": "Posts",
  "schema": {
    "fields": [
      {
        "name": "title",
        "type": "string",
        "required": true
      },
      {
        "name": "slug",
        "type": "string",
        "required": true,
        "unique": true
      },
      {
        "name": "excerpt",
        "type": "text"
      },
      {
        "name": "content",
        "type": "text",
        "required": true
      },
      {
        "name": "featuredImage",
        "type": "file"
      },
      {
        "name": "authorName",
        "type": "string",
        "required": true
      },
      {
        "name": "authorEmail",
        "type": "email",
        "required": true
      },
      {
        "name": "tags",
        "type": "json"
      },
      {
        "name": "status",
        "type": "string",
        "default": "draft",
        "validation": {
          "enum": ["draft", "published", "archived"]
        }
      },
      {
        "name": "publishedAt",
        "type": "datetime"
      },
      {
        "name": "views",
        "type": "number",
        "default": 0
      }
    ],
    "timestamps": true,
    "softDelete": true
  }
}
```

#### Comments Collection

```json
{
  "name": "Comments",
  "schema": {
    "fields": [
      {
        "name": "postId",
        "type": "string",
        "required": true
      },
      {
        "name": "authorName",
        "type": "string",
        "required": true
      },
      {
        "name": "authorEmail",
        "type": "email",
        "required": true
      },
      {
        "name": "content",
        "type": "text",
        "required": true
      },
      {
        "name": "isApproved",
        "type": "boolean",
        "default": false
      },
      {
        "name": "parentId",
        "type": "string"
      }
    ],
    "timestamps": true,
    "softDelete": true
  }
}
```

### Example Usage

```bash
# Create post
curl -X POST http://localhost:3000/api/data/my-blog/posts \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_xxx" \
  -d '{
    "title": "Getting Started with Node.js",
    "slug": "getting-started-nodejs",
    "excerpt": "Learn the basics of Node.js",
    "content": "Full article content here...",
    "featuredImage": "/uploads/nodejs.jpg",
    "authorName": "Jane Smith",
    "authorEmail": "jane@example.com",
    "tags": ["nodejs", "javascript", "tutorial"],
    "status": "published",
    "publishedAt": "2024-01-15T10:00:00Z"
  }'

# Get published posts
curl "http://localhost:3000/api/data/my-blog/posts?filter={\"status\":\"published\"}&sort=publishedAt&order=desc" \
  -H "X-API-Key: sk_xxx"

# Add comment
curl -X POST http://localhost:3000/api/data/my-blog/comments \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_xxx" \
  -d '{
    "postId": "post-123",
    "authorName": "John Reader",
    "authorEmail": "john@example.com",
    "content": "Great article! Very helpful.",
    "isApproved": true
  }'
```

---

## 3. Todo Application

### Schema Definition

```json
{
  "name": "Tasks",
  "schema": {
    "fields": [
      {
        "name": "title",
        "type": "string",
        "required": true
      },
      {
        "name": "description",
        "type": "text"
      },
      {
        "name": "completed",
        "type": "boolean",
        "default": false
      },
      {
        "name": "priority",
        "type": "string",
        "default": "medium",
        "validation": {
          "enum": ["low", "medium", "high", "urgent"]
        }
      },
      {
        "name": "dueDate",
        "type": "date"
      },
      {
        "name": "assignedTo",
        "type": "email"
      },
      {
        "name": "tags",
        "type": "json"
      },
      {
        "name": "completedAt",
        "type": "datetime"
      }
    ],
    "timestamps": true,
    "softDelete": false
  }
}
```

### Example Usage

```bash
# Create task
curl -X POST http://localhost:3000/api/data/todo-app/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_xxx" \
  -d '{
    "title": "Complete project documentation",
    "description": "Write comprehensive docs for the API",
    "priority": "high",
    "dueDate": "2024-01-20",
    "assignedTo": "dev@example.com",
    "tags": ["documentation", "api"]
  }'

# Get pending tasks
curl "http://localhost:3000/api/data/todo-app/tasks?filter={\"completed\":false}&sort=priority" \
  -H "X-API-Key: sk_xxx"

# Mark as complete
curl -X PATCH http://localhost:3000/api/data/todo-app/tasks/task-123 \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sk_xxx" \
  -d '{
    "completed": true,
    "completedAt": "2024-01-18T15:30:00Z"
  }'
```

---

## 4. CRM System

### Schema Definitions

#### Contacts Collection

```json
{
  "name": "Contacts",
  "schema": {
    "fields": [
      {
        "name": "firstName",
        "type": "string",
        "required": true
      },
      {
        "name": "lastName",
        "type": "string",
        "required": true
      },
      {
        "name": "email",
        "type": "email",
        "required": true,
        "unique": true
      },
      {
        "name": "phone",
        "type": "string"
      },
      {
        "name": "company",
        "type": "string"
      },
      {
        "name": "position",
        "type": "string"
      },
      {
        "name": "status",
        "type": "string",
        "default": "lead",
        "validation": {
          "enum": ["lead", "prospect", "customer", "inactive"]
        }
      },
      {
        "name": "tags",
        "type": "json"
      },
      {
        "name": "notes",
        "type": "text"
      },
      {
        "name": "lastContactDate",
        "type": "date"
      }
    ],
    "timestamps": true,
    "softDelete": true
  }
}
```

#### Deals Collection

```json
{
  "name": "Deals",
  "schema": {
    "fields": [
      {
        "name": "title",
        "type": "string",
        "required": true
      },
      {
        "name": "contactId",
        "type": "string",
        "required": true
      },
      {
        "name": "value",
        "type": "number",
        "required": true,
        "validation": {
          "min": 0
        }
      },
      {
        "name": "stage",
        "type": "string",
        "default": "qualification",
        "validation": {
          "enum": [
            "qualification",
            "proposal",
            "negotiation",
            "closed-won",
            "closed-lost"
          ]
        }
      },
      {
        "name": "probability",
        "type": "number",
        "default": 50,
        "validation": {
          "min": 0,
          "max": 100
        }
      },
      {
        "name": "expectedCloseDate",
        "type": "date"
      },
      {
        "name": "actualCloseDate",
        "type": "date"
      },
      {
        "name": "notes",
        "type": "text"
      }
    ],
    "timestamps": true
  }
}
```

---

## 5. Event Management

### Schema Definition

```json
{
  "name": "Events",
  "schema": {
    "fields": [
      {
        "name": "title",
        "type": "string",
        "required": true
      },
      {
        "name": "slug",
        "type": "string",
        "required": true,
        "unique": true
      },
      {
        "name": "description",
        "type": "text",
        "required": true
      },
      {
        "name": "location",
        "type": "string",
        "required": true
      },
      {
        "name": "startDate",
        "type": "datetime",
        "required": true
      },
      {
        "name": "endDate",
        "type": "datetime",
        "required": true
      },
      {
        "name": "capacity",
        "type": "number",
        "required": true
      },
      {
        "name": "registeredCount",
        "type": "number",
        "default": 0
      },
      {
        "name": "price",
        "type": "number",
        "default": 0
      },
      {
        "name": "bannerImage",
        "type": "file"
      },
      {
        "name": "category",
        "type": "string",
        "validation": {
          "enum": ["conference", "workshop", "meetup", "webinar"]
        }
      },
      {
        "name": "isPublished",
        "type": "boolean",
        "default": false
      },
      {
        "name": "isFull",
        "type": "boolean",
        "default": false
      }
    ],
    "timestamps": true
  }
}
```

---

## Tips & Best Practices

### 1. Field Naming

- Use camelCase for field names
- Use descriptive names
- Avoid reserved keywords (id, createdAt, updatedAt, deletedAt)

### 2. Validation

- Always set `required: true` for important fields
- Use `unique: true` for fields that must be unique (email, slug, sku)
- Set `validation.enum` for fields with limited values
- Set `validation.min` and `max` for number fields

### 3. Timestamps

- Enable `timestamps: true` for audit trails
- Enable `softDelete: true` if data needs to be restored

### 4. JSON Fields

Use JSON fields for:

- Arrays (tags, images, items)
- Nested objects (address, metadata)
- Dynamic data

### 5. Performance

- Create indexes for frequently queried fields
- Use Pagination for endpoints list
- Filter only required fields

---

For questions or other use case examples, please open an issue in the repository!
