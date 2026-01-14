#Calmsey BaaS - Self-hosted BaaS & API Platform

Build production-ready backends without writing boilerplate code. A Backend as a Service platform that allows you to dynamically create REST APIs based on a defined schema. Built with Node.js, Fastify, and Prisma.

## ✨ Features

- 🚀 **Dynamic API Generation** - Automatically create REST APIs based on JSON schemas
- ⚡ **Custom Functions** - Serverless functions with TypeScript/JavaScript (NEW!)
- 🔐 **Authentication & Authorization** - JWT authentication + API key management
- 📊 **Multi-tenant** - Project isolation with a database per project
- 🗄️ **Database Flexibility** - Supports PostgreSQL and MySQL
- 📁 **File Upload** - Local and cloud storage (S3 ready)
- 🔍 **Query & Filtering** - Built-in pagination, sorting, and filtering
- 📝 **Schema Validation** - Automatic data validation based on schemas
- 🗑️ **Soft Delete** - Optional soft delete for collections
- ⏰ **Timestamps** - Auto-generated createdAt and updatedAt

## 🏗️ Architecture

```
┌─────────────────────────────────────┐
│   Management API (Admin)            │
│  - User Management                  │
│  - Project Management               │
│  - Collection/Schema Definition     │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│      Dynamic API Engine             │
│  - Schema Parser                    │
│  - Query Builder                    │
│  - Validation                       │
└──────────────┬──────────────────────┘
               │
┌──────────────▼──────────────────────┐
│   Auto-generated REST API           │
│  /api/data/:project/:collection     │
│  - GET (list & detail)              │
│  - POST (create)                    │
│  - PATCH (update)                   │
│  - DELETE (delete)                  │
└─────────────────────────────────────┘
```

## 🛠️ Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify 4
- **ORM**: Prisma 5
- **Database**: PostgreSQL / MySQL
- **Authentication**: JWT + API Keys
- **Validation**: Zod
- **Language**: TypeScript

## 📦 Installation

### Prerequisites

- Node.js 20 or higher
- PostgreSQL 14+ or MySQL 8+
- npm or yarn

### Setup

1. **Clone or copy project**

```bash
git clone https://github.com/wisnuvb/calmsey-baas.git
cd calmsey-baas
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment variables**

```bash
cp .env.example .env
```

Edit `.env` and adjust it to your configuration:

```env
# Database URL (choose one)
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/baas_poc"

# MySQL (uncomment if using MySQL)
# DATABASE_URL="mysql://user:password@localhost:3306/baas_poc"

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Storage (local/s3)
STORAGE_TYPE=local

# AI (optional, for AI-assisted Function Editor)
# Required: Your DeepSeek API key
DEEPSEEK_API_KEY="your-deepseek-api-key"
# Optional: Base URL (leave default if unsure)
DEEPSEEK_API_BASE="https://api.deepseek.com/v1"
# Optional: Model
DEEPSEEK_MODEL="deepseek-chat"
```

4. **Update Prisma schema if using MySQL**

If using MySQL, edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "mysql"  // replace from "postgresql"
  url      = env("DATABASE_URL")
}
```

5. **Generate Prisma client dan migrate database**

```bash
npm run prisma:generate
npm run prisma:migrate
```

6. **Run development server**

```bash
npm run dev
```

The server will run at `http://localhost:3000`

### AI Code Generation (DeepSeek)

The Function Editor dashboard supports generating function code via AI. To enable it:

- Set `DEEPSEEK_API_KEY` in the backend `.env`
- Run the server (`npm run dev`)
- Go to Dashboard → Functions → Create/Edit → click "✨ Generate with AI"

Note: This integration uses an OpenAI-compatible endpoint (`/v1/chat/completions`). If your DeepSeek uses a different base URL, set `DEEPSEEK_API_BASE`.

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

The API uses two types of authentication:

1. JWT Token - For API management (user, project, collection)
2. API Key - For dynamic data APIs

---

## 🔐 Auth Endpoints

### Register User

```http
POST /api/auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "user@example.com",
      "name": "John Doe"
    },
    "token": "eyJhbGc..."
  }
}
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123"
}
```

### Get Current User

```http
GET /api/auth/me
Authorization: Bearer {token}
```

---

## 📁 Project Management

### Create Project

```http
POST /api/projects
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "My E-commerce",
  "description": "E-commerce backend API"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "id": "...",
    "name": "My E-commerce",
    "slug": "my-e-commerce",
    "apiKeys": [
      {
        "id": "...",
        "name": "Default API Key",
        "key": "sk_..."
      }
    ]
  }
}
```

### List Projects

```http
GET /api/projects
Authorization: Bearer {token}
```

### Get Project Details

```http
GET /api/projects/:id
Authorization: Bearer {token}
```

### Create API Key

```http
POST /api/projects/:id/api-keys
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Production API Key"
}
```

---

## 📝 Collection Management (Schema Definition)

### Create Collection

```http
POST /api/collections?projectId={projectId}
Authorization: Bearer {token}
Content-Type: application/json

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
        "name": "stock",
        "type": "number",
        "required": true,
        "default": 0
      },
      {
        "name": "category",
        "type": "string",
        "validation": {
          "enum": ["electronics", "fashion", "food"]
        }
      },
      {
        "name": "isActive",
        "type": "boolean",
        "default": true
      }
    ],
    "timestamps": true,
    "softDelete": false
  }
}
```

**Field Types:**

- `string` - VARCHAR(255)
- `text` - TEXT
- `number` - NUMERIC
- `boolean` - BOOLEAN
- `date` - DATE
- `datetime` - TIMESTAMP
- `email` - VARCHAR(255) with email validation
- `url` - VARCHAR(500) with URL validation
- `json` - JSONB/JSON
- `file` - VARCHAR(500) for file paths

### List Collections

```http
GET /api/collections?projectId={projectId}
Authorization: Bearer {token}
```

### Update Collection

```http
PATCH /api/collections/:id
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Updated Name",
  "schema": { ... }
}
```

---

## 🚀 Dynamic Data API (Auto-generated)

Once the collection is created, the API will be automatically available in:

```
/api/data/:projectSlug/:collectionSlug
```

**Authentication:** Use the header `X-API-Key: sk_...`

### Create Item

```http
POST /api/data/my-e-commerce/products
X-API-Key: sk_your_api_key
Content-Type: application/json

{
  "name": "iPhone 15",
  "description": "Latest iPhone",
  "price": 999,
  "stock": 50,
  "category": "electronics",
  "isActive": true
}
```

### List Items

```http
GET /api/data/my-e-commerce/products?page=1&limit=10&sort=createdAt&order=desc
X-API-Key: sk_your_api_key
```

**Query Parameters:**

- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10)
- `sort` - Sort field (default: createdAt)
- `order` - Sort order: asc/desc (default: desc)
- `filter` - JSON string for filtering: `{"category":"electronics"}`

**Response:**

```json
{
  "success": true,
  "data": [...],
  "meta": {
    "total": 100,
    "page": 1,
    "limit": 10,
    "totalPages": 10
  }
}
```

### Get Single Item

```http
GET /api/data/my-e-commerce/products/:id
X-API-Key: sk_your_api_key
```

### Update Item

```http
PATCH /api/data/my-e-commerce/products/:id
X-API-Key: sk_your_api_key
Content-Type: application/json

{
  "price": 899,
  "stock": 45
}
```

### Delete Item

```http
DELETE /api/data/my-e-commerce/products/:id
X-API-Key: sk_your_api_key
```

---

## 📤 File Upload

### Upload Single File

```http
POST /api/upload/:projectSlug
X-API-Key: sk_your_api_key
Content-Type: multipart/form-data

file: [binary]
```

**Response:**

```json
{
  "success": true,
  "data": {
    "filename": "abc123.jpg",
    "originalName": "photo.jpg",
    "size": 102400,
    "mimetype": "image/jpeg",
    "url": "/uploads/abc123.jpg",
    "path": "/path/to/uploads/abc123.jpg"
  }
}
```

### Upload Multiple Files

```http
POST /api/upload/:projectSlug/multiple
X-API-Key: sk_your_api_key
Content-Type: multipart/form-data

file: [binary]
file: [binary]
```

---

## 🧪 Example Use Cases

### 1. E-commerce Backend

**Collections:**

- Products
- Categories
- Orders
- Customers

### 2. Blog Platform

**Collections:**

- Posts
- Authors
- Comments
- Tags

### 3. B2B Application

**Collections:**

- Companies
- Contacts
- Deals
- Activities

---

## 🔧 Development

### Project Structure

```
calmsey-baas/
├── prisma/
│   └── schema.prisma          # Database schema
├── src/
│   ├── lib/
│   │   ├── prisma.ts          # Prisma client
│   │   ├── password.ts        # Password utilities
│   │   ├── utils.ts           # Helper functions
│   │   ├── dynamic-query-builder.ts  # Query builder
│   │   └── file-upload.service.ts    # File upload
│   ├── middleware/
│   │   └── auth.middleware.ts # Authentication
│   ├── routes/
│   │   ├── auth.routes.ts
│   │   ├── project.routes.ts
│   │   ├── collection.routes.ts
│   │   ├── dynamic-api.routes.ts
│   │   └── upload.routes.ts
│   ├── types/
│   │   └── index.ts           # TypeScript types
│   └── server.ts              # Main server
├── .env                       # Environment variables
└── package.json
```

### Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload

# Build
npm run build            # Compile TypeScript

# Production
npm start                # Run compiled server

# Database
npm run prisma:generate  # Generate Prisma client
npm run prisma:migrate   # Run migrations
npm run prisma:studio    # Open Prisma Studio
```

---

## 🚀 Production Deployment

### Environment Variables for Production

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="your-production-database-url"
JWT_SECRET="strong-random-secret"
```

### Build and Run

```bash
npm run build
NODE_ENV=production npm start
```

### Docker (Optional)

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 🎯 Next Steps

For further development, the following features can be added:

1. Email Integration - Nodemailer for transactional emails
2. Real-time - WebSocket/SSE for live updates
3. GraphQL - Alternative API with GraphQL
4. Relationships - One-to-many, many-to-many relationships
5. Webhooks - Event notifications
6. Rate Limiting - API throttling
7. Caching - Redis for performance
8. Search - Full-text search with Elasticsearch
9. Admin Dashboard - Web UI for management
10. API Documentation - Auto-generated Swagger/OpenAPI

---

## 📄 License

MIT

---

## 🤝 Contributing

Feel free to contribute and improve this project!

---

## 📞 Support

If you have any questions or issues, please create an issue in the repository.
