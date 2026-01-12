# Calmsey BaaS (Backend as a Service)

Backend as a Service platform yang memungkinkan Anda membuat REST API secara dinamis berdasarkan schema yang didefinisikan. Dibangun dengan Node.js, Fastify, dan Prisma.

## ✨ Fitur

- 🚀 **Dynamic API Generation** - Buat REST API otomatis berdasarkan schema JSON
- ⚡ **Custom Functions** - Serverless functions dengan TypeScript/JavaScript (NEW!)
- 🔐 **Authentication & Authorization** - JWT authentication + API key management
- 📊 **Multi-tenant** - Project isolation dengan database per project
- 🗄️ **Database Flexibility** - Support PostgreSQL dan MySQL
- 📁 **File Upload** - Local storage dan cloud storage (S3 ready)
- 🔍 **Query & Filtering** - Pagination, sorting, dan filtering built-in
- 📝 **Schema Validation** - Validasi data otomatis berdasarkan schema
- 🗑️ **Soft Delete** - Optional soft delete untuk collections
- ⏰ **Timestamps** - Auto-generated createdAt dan updatedAt

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

- Node.js 20 atau lebih tinggi
- PostgreSQL 14+ atau MySQL 8+
- npm atau yarn

### Setup

1. **Clone atau copy project**

```bash
cd baas-poc
```

2. **Install dependencies**

```bash
npm install
```

3. **Setup environment variables**

```bash
cp .env.example .env
```

Edit `.env` dan sesuaikan dengan konfigurasi Anda:

```env
# Database URL (pilih salah satu)
# PostgreSQL
DATABASE_URL="postgresql://user:password@localhost:5432/baas_poc"

# MySQL (uncomment jika pakai MySQL)
# DATABASE_URL="mysql://user:password@localhost:3306/baas_poc"

# JWT Secret
JWT_SECRET=your-super-secret-jwt-key

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Storage (local/s3)
STORAGE_TYPE=local

# AI (optional, untuk AI-assisted Function Editor)
# Wajib: API key DeepSeek Anda
DEEPSEEK_API_KEY="your-deepseek-api-key"
# Opsional: Base URL (biarkan default jika tidak yakin)
DEEPSEEK_API_BASE="https://api.deepseek.com/v1"
# Opsional: Model
DEEPSEEK_MODEL="deepseek-chat"
```

4. **Update Prisma schema jika pakai MySQL**

Jika menggunakan MySQL, edit `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "mysql"  // ganti dari "postgresql"
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

Server akan berjalan di `http://localhost:3000`

### AI Code Generation (DeepSeek)

Dashboard Function Editor mendukung generate kode function via AI. Untuk mengaktifkan:

- Set `DEEPSEEK_API_KEY` di `.env` backend
- Jalankan server (`npm run dev`)
- Buka Dashboard → Functions → Create/Edit → klik "✨ Generate with AI"

Catatan: Integrasi ini menggunakan endpoint kompatibel OpenAI (`/v1/chat/completions`). Jika DeepSeek Anda memakai base URL berbeda, atur `DEEPSEEK_API_BASE`.

## 📚 API Documentation

### Base URL

```
http://localhost:3000/api
```

### Authentication

API menggunakan dua jenis authentication:

1. **JWT Token** - Untuk management API (user, project, collection)
2. **API Key** - Untuk dynamic data API

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

Setelah collection dibuat, API akan otomatis tersedia di:

```
/api/data/:projectSlug/:collectionSlug
```

**Authentication:** Gunakan header `X-API-Key: sk_...`

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
baas-poc/
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

Untuk pengembangan lebih lanjut, berikut fitur yang bisa ditambahkan:

1. **Email Integration** - Nodemailer untuk transactional emails
2. **Real-time** - WebSocket/SSE untuk live updates
3. **GraphQL** - Alternative API dengan GraphQL
4. **Relations** - One-to-many, many-to-many relationships
5. **Webhooks** - Event notifications
6. **Rate Limiting** - API throttling
7. **Caching** - Redis untuk performance
8. **Search** - Full-text search dengan Elasticsearch
9. **Admin Dashboard** - Web UI untuk management
10. **API Documentation** - Auto-generated Swagger/OpenAPI

---

## 📄 License

MIT

---

## 🤝 Contributing

Feel free to contribute dan improve PoC ini!

---

## 📞 Support

Jika ada pertanyaan atau issue, silakan buat issue di repository.
