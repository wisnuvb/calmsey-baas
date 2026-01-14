# Setup Guide - Calmsey BaaS

This is a complete guide to setting up and testing Calmsey BaaS.

## Prerequisites

Before starting, make sure you have installed:

- Node.js 20+ ([Download](https://nodejs.org/))
- PostgreSQL 14+ atau MySQL 8+
- Git (optional)

## Step-by-Step Setup

### 1. Database Setup

#### For PostgreSQL:

```bash
# Install PostgreSQL (if not already)
# macOS
brew install postgresql@14
brew services start postgresql@14

# Ubuntu/Debian
sudo apt install postgresql-14
sudo systemctl start postgresql

# Windows: Download installer from postgresql.org

# Create database
psql -U postgres
CREATE DATABASE baas_poc;
\q
```

#### For MySQL:

```bash
# Install MySQL (if not already)
# macOS
brew install mysql
brew services start mysql

# Ubuntu/Debian
sudo apt install mysql-server
sudo systemctl start mysql

# Windows: Download installer from mysql.com

# Create database
mysql -u root -p
CREATE DATABASE baas_poc;
exit;
```

### 2. Project Setup

```bash
# Go to the project directory
cd calmsey-baas

# Install dependencies
npm install

# Copy and edit .env file
cp .env.example .env
nano .env
```

**Edit .env according to your database:**

```env
# For PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/baas_poc?schema=public"

# For MySQL
DATABASE_URL="mysql://root:password@localhost:3306/baas_poc"
```

### 3. Database Migration

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations (create tables)
npm run prisma:migrate

# (Optional) Open Prisma Studio to view the database
npm run prisma:studio
```

### 4. Start Development Server

```bash
npm run dev
```

The server will run at `http://localhost:3000`

Test with curl:

```bash
curl http://localhost:3000/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

---

## Quick Start Testing

Once the server is running, test it with the following flow:

### 1. Register User

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }'
```

Save the `token` from the response.

### 2. Create Project

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Test Project",
    "description": "My first BaaS project"
  }'
```

Save `slug` and `apiKey` from response.

### 3. Create Collection

```bash
curl -X POST "http://localhost:3000/api/collections?projectId=PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
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
        }
      ],
      "timestamps": true
    }
  }'
```

### 4. Use Dynamic API

```bash
# Create item
curl -X POST http://localhost:3000/api/data/test-project/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "title": "Buy groceries",
    "description": "Milk, eggs, bread",
    "completed": false
  }'

# List items
curl http://localhost:3000/api/data/test-project/tasks \
  -H "X-API-Key: YOUR_API_KEY"

# Get single item
curl http://localhost:3000/api/data/test-project/tasks/ITEM_ID \
  -H "X-API-Key: YOUR_API_KEY"

# Update item
curl -X PATCH http://localhost:3000/api/data/test-project/tasks/ITEM_ID \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{
    "completed": true
  }'

# Delete item
curl -X DELETE http://localhost:3000/api/data/test-project/tasks/ITEM_ID \
  -H "X-API-Key: YOUR_API_KEY"
```

---

## Troubleshooting

### Error: "Database connection failed"

**Solution:**

1. Make sure the database server is running.
2. Check the DATABASE_URL in .env.
3. Test the database connection:

   ```bash
   # PostgreSQL
   psql -U postgres -d baas_poc

   # MySQL
   mysql -u root -p baas_poc
   ```

### Error: "Cannot find module '@prisma/client'"

**Solution:**

```bash
npm run prisma:generate
```

### Error: "Port 3000 already in use"

**Solution:**

1. Change PORT in .env
2. Or kill the process using port 3000:

   ```bash
   # macOS/Linux
   lsof -ti:3000 | xargs kill -9

   # Windows
   netstat -ano | findstr :3000
   taskkill /PID <PID> /F
   ```

### Migration Error

**Solution:**

```bash
# Reset database
npm run prisma:migrate reset

# Re-run migration
npm run prisma:migrate
```

---

## Using with Postman

1. Import the collection from the `postman_collection.json` file (which will be created later)
2. Set environment variables:
   - `base_url`: http://localhost:3000
   - `token`: (dari login response)
   - `api_key`: (dari create project response)

---

## Production Deployment

### Environment Variables

```env
NODE_ENV=production
PORT=3000
DATABASE_URL="your-production-database-url"
JWT_SECRET="use-strong-random-secret-here"
UPLOAD_DIR=/var/uploads
STORAGE_TYPE=s3
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket
```

### Build and Deploy

```bash
# Build
npm run build

# Run production
NODE_ENV=production npm start
```

### Using PM2 (Recommended)

```bash
# Install PM2
npm install -g pm2

# Start
pm2 start dist/server.js --name baas-api

# Monitor
pm2 monit

# Logs
pm2 logs baas-api

# Restart
pm2 restart baas-api

# Stop
pm2 stop baas-api
```

---

## Database Maintenance

### Backup

```bash
# PostgreSQL
pg_dump -U postgres baas_poc > backup.sql

# MySQL
mysqldump -u root -p baas_poc > backup.sql
```

### Restore

```bash
# PostgreSQL
psql -U postgres baas_poc < backup.sql

# MySQL
mysql -u root -p baas_poc < backup.sql
```

---

## Next Steps

After successful setup, explore:

1. Create multiple projects
2. Define various collection schemas
3. Test dynamic APIs with different data types
4. Try file upload
5. Test validation rules
6. Experiment with filtering and pagination

For a more complete use case example, see `EXAMPLES.md`.
