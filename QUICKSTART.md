# Quick Start Guide

Get your BaaS up and running in 5 minutes!

## Prerequisites

- Node.js 20+
- PostgreSQL or MySQL running locally

## Setup (5 Steps)

### 1. Install Dependencies

```bash
cd baas-poc
npm install
```

### 2. Configure Database

Edit `.env`:

```env
# For PostgreSQL
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/baas_poc"

# OR for MySQL
# DATABASE_URL="mysql://root:password@localhost:3306/baas_poc"
```

### 3. Setup Database

```bash
npm run prisma:generate
npm run prisma:migrate
```

### 4. Start Server

```bash
npm run dev
```

Server running at `http://localhost:3000` ✅

### 5. Test It!

Make the test script executable and run it:

```bash
chmod +x test-api.sh
./test-api.sh
```

Or test manually:

**Register:**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test"}'
```

Save the `token` from response.

**Create Project:**

```bash
curl -X POST http://localhost:3000/api/projects \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name":"My Project"}'
```

Save the `slug` and `apiKeys[0].key` from response.

**Create Collection:**

```bash
curl -X POST "http://localhost:3000/api/collections?projectId=PROJECT_ID" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "name": "Tasks",
    "schema": {
      "fields": [
        {"name": "title", "type": "string", "required": true},
        {"name": "completed", "type": "boolean", "default": false}
      ],
      "timestamps": true
    }
  }'
```

**Use Dynamic API:**

```bash
# Create
curl -X POST http://localhost:3000/api/data/my-project/tasks \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d '{"title":"Buy groceries","completed":false}'

# List
curl http://localhost:3000/api/data/my-project/tasks \
  -H "X-API-Key: YOUR_API_KEY"
```

## Next Steps

- Read [EXAMPLES.md](EXAMPLES.md) for more use cases
- Read [README.md](README.md) for complete API documentation
- Read [ARCHITECTURE.md](ARCHITECTURE.md) for technical deep-dive

## Common Issues

**Port 3000 already in use?**

```bash
# Change PORT in .env
PORT=3001
```

**Database connection failed?**

```bash
# Check if database is running
# PostgreSQL
psql -U postgres

# MySQL
mysql -u root -p
```

**Prisma errors?**

```bash
# Regenerate client
npm run prisma:generate
```

## Production Checklist

Before deploying to production:

- [ ] Change `JWT_SECRET` to strong random value
- [ ] Set `NODE_ENV=production`
- [ ] Use production database URL
- [ ] Enable HTTPS
- [ ] Set up monitoring
- [ ] Configure backups
- [ ] Add rate limiting
- [ ] Review CORS settings

## Resources

- 📚 [Complete Documentation](README.md)
- 🏗️ [Architecture Guide](ARCHITECTURE.md)
- 📋 [Examples](EXAMPLES.md)
- ⚙️ [Setup Guide](SETUP.md)
- 🧪 [Test Script](test-api.sh)

---

**That's it! You now have a working BaaS platform!** 🎉
