# Dashboard Statistics API - Usage Guide

Complete guide for using dashboard statistics and aggregation APIs with real-world examples.

## Table of Contents

1. [Overview](#overview)
2. [Built-in Dashboard Stats Endpoint](#built-in-dashboard-stats-endpoint)
3. [Flexible Aggregation API](#flexible-aggregation-api)
4. [Real-World Examples](#real-world-examples)
5. [Frontend Integration](#frontend-integration)

---

## Overview

The dashboard statistics API provides two powerful approaches for building analytics dashboards:

1. **Built-in Dashboard Stats** (`GET /api/dashboard/:projectSlug/stats`)
   - Pre-built comprehensive statistics
   - Multiple collections in one request
   - Perfect for standard dashboards

2. **Flexible Aggregation API** (`POST /api/dashboard/:projectSlug/aggregate`)
   - Custom aggregations with any function
   - Dynamic grouping and filtering
   - Perfect for custom analytics

---

## Built-in Dashboard Stats Endpoint

### Overview

Get comprehensive dashboard statistics for your project with multiple collections aggregated in one request.

### Endpoint

```http
GET /api/dashboard/:projectSlug/stats
X-API-Key: your-api-key
```

### Example: News App Dashboard

**Request:**
```bash
curl -X GET http://localhost:3000/api/dashboard/my-news-site/stats \
  -H "X-API-Key: sk_..."
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "articles": 1250,
      "categories": 15,
      "readers": 5420,
      "totalViews": 125340,
      "publishedToday": 12
    },
    "articlesByCategory": [
      { "category": "Technology", "count": 340 },
      { "category": "Business", "count": 280 },
      { "category": "Sports", "count": 210 }
    ],
    "articlesByStatus": [
      { "status": "published", "count": 1100 },
      { "status": "draft", "count": 150 }
    ],
    "topAuthors": [
      { "authorId": "user-123", "count": 45, "totalViews": 12500 },
      { "authorId": "user-456", "count": 38, "totalViews": 9800 }
    ],
    "viewsTrend": [
      { "date": "2024-01-15", "views": 1250 },
      { "date": "2024-01-14", "views": 1180 }
    ]
  }
}
```

### How to Customize

Edit `src/routes/dashboard.routes.ts` to match your schema:

```typescript
// Example: E-commerce dashboard
const [productsCount, ordersCount, customersCount] = await Promise.all([
  prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablePrefix}_products"`),
  prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablePrefix}_orders"`),
  prisma.$queryRawUnsafe(`SELECT COUNT(*) as count FROM "${tablePrefix}_customers"`)
]);

const revenueByMonth = await prisma.$queryRawUnsafe(`
  SELECT
    DATE_TRUNC('month', "createdAt") as month,
    SUM("total") as revenue
  FROM "${tablePrefix}_orders"
  WHERE "status" = 'completed'
  GROUP BY DATE_TRUNC('month', "createdAt")
  ORDER BY month DESC
  LIMIT 12
`);
```

---

## Flexible Aggregation API

### Overview

Dynamically aggregate data with custom functions, filters, and grouping.

### Endpoint

```http
POST /api/dashboard/:projectSlug/aggregate
X-API-Key: your-api-key
Content-Type: application/json
```

### Request Schema

```typescript
{
  collection: string;           // Collection slug
  aggregations: Array<{
    function: 'count' | 'sum' | 'avg' | 'min' | 'max';
    field: string;              // Field to aggregate (use '*' for count)
    alias: string;              // Result field name
  }>;
  filters?: Array<{
    field: string;
    operator: '=' | '>' | '<' | '>=' | '<=' | '!=';
    value: any;
  }>;
  groupBy?: string;             // Field to group by
}
```

### Examples

#### 1. Count Articles by Category

**Request:**
```bash
curl -X POST http://localhost:3000/api/dashboard/my-news-site/aggregate \
  -H "X-API-Key: sk_..." \
  -H "Content-Type: application/json" \
  -d '{
    "collection": "articles",
    "aggregations": [
      {
        "function": "count",
        "field": "*",
        "alias": "articleCount"
      }
    ],
    "groupBy": "category"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "category": "Technology", "articleCount": 340 },
    { "category": "Business", "articleCount": 280 },
    { "category": "Sports", "articleCount": 210 }
  ]
}
```

#### 2. Total Views by Author (with filter)

**Request:**
```json
{
  "collection": "articles",
  "aggregations": [
    {
      "function": "count",
      "field": "*",
      "alias": "articleCount"
    },
    {
      "function": "sum",
      "field": "views",
      "alias": "totalViews"
    }
  ],
  "filters": [
    {
      "field": "status",
      "operator": "=",
      "value": "published"
    }
  ],
  "groupBy": "authorId"
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    { "authorId": "user-123", "articleCount": 45, "totalViews": 12500 },
    { "authorId": "user-456", "articleCount": 38, "totalViews": 9800 }
  ]
}
```

#### 3. Revenue Statistics (E-commerce)

**Request:**
```json
{
  "collection": "orders",
  "aggregations": [
    {
      "function": "count",
      "field": "*",
      "alias": "orderCount"
    },
    {
      "function": "sum",
      "field": "total",
      "alias": "totalRevenue"
    },
    {
      "function": "avg",
      "field": "total",
      "alias": "averageOrderValue"
    },
    {
      "function": "max",
      "field": "total",
      "alias": "largestOrder"
    }
  ],
  "filters": [
    {
      "field": "status",
      "operator": "=",
      "value": "completed"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "orderCount": 1250,
      "totalRevenue": 187500.50,
      "averageOrderValue": 150.00,
      "largestOrder": 2500.00
    }
  ]
}
```

#### 4. Monthly Revenue (Grouped by Month)

**Request:**
```json
{
  "collection": "orders",
  "aggregations": [
    {
      "function": "count",
      "field": "*",
      "alias": "orderCount"
    },
    {
      "function": "sum",
      "field": "total",
      "alias": "revenue"
    }
  ],
  "filters": [
    {
      "field": "status",
      "operator": "=",
      "value": "completed"
    }
  ],
  "groupBy": "month(createdAt)"
}
```

---

## Real-World Examples

### News App Dashboard

```javascript
// Frontend code to fetch news app dashboard
async function fetchNewsDashboard() {
  const apiKey = 'sk_...';
  const projectSlug = 'my-news-site';

  // Option 1: Use built-in stats endpoint
  const statsResponse = await fetch(
    `http://localhost:3000/api/dashboard/${projectSlug}/stats`,
    {
      headers: { 'X-API-Key': apiKey }
    }
  );
  const stats = await statsResponse.json();

  console.log('Total Articles:', stats.data.overview.articles);
  console.log('Categories:', stats.data.overview.categories);
  console.log('Readers:', stats.data.overview.readers);

  // Option 2: Use flexible aggregation for custom query
  const categoryStats = await fetch(
    `http://localhost:3000/api/dashboard/${projectSlug}/aggregate`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        collection: 'articles',
        aggregations: [
          { function: 'count', field: '*', alias: 'count' },
          { function: 'sum', field: 'views', alias: 'totalViews' }
        ],
        filters: [
          { field: 'status', operator: '=', value: 'published' }
        ],
        groupBy: 'category'
      })
    }
  );
  const categoryData = await categoryStats.json();

  console.log('Articles by Category:', categoryData.data);
}
```

### E-commerce Dashboard

```javascript
async function fetchEcommerceDashboard() {
  const apiKey = 'sk_...';
  const projectSlug = 'my-shop';

  // Get total revenue and order stats
  const revenueStats = await fetch(
    `http://localhost:3000/api/dashboard/${projectSlug}/aggregate`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        collection: 'orders',
        aggregations: [
          { function: 'count', field: '*', alias: 'totalOrders' },
          { function: 'sum', field: 'total', alias: 'revenue' },
          { function: 'avg', field: 'total', alias: 'avgOrderValue' }
        ],
        filters: [
          { field: 'status', operator: '=', value: 'completed' }
        ]
      })
    }
  );

  // Get product inventory stats
  const inventoryStats = await fetch(
    `http://localhost:3000/api/dashboard/${projectSlug}/aggregate`,
    {
      method: 'POST',
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        collection: 'products',
        aggregations: [
          { function: 'count', field: '*', alias: 'productCount' },
          { function: 'sum', field: 'stock', alias: 'totalStock' },
          { function: 'avg', field: 'price', alias: 'avgPrice' }
        ]
      })
    }
  );

  const revenue = await revenueStats.json();
  const inventory = await inventoryStats.json();

  return {
    revenue: revenue.data[0],
    inventory: inventory.data[0]
  };
}
```

---

## Frontend Integration

### React Example

```jsx
import { useEffect, useState } from 'react';

function NewsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Fetch built-in stats
      const response = await fetch(
        'http://localhost:3000/api/dashboard/my-news-site/stats',
        {
          headers: { 'X-API-Key': 'sk_...' }
        }
      );
      const data = await response.json();
      setStats(data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h1>News Dashboard</h1>

      {/* Overview Cards */}
      <div className="stats-grid">
        <StatCard title="Total Articles" value={stats.overview.articles} />
        <StatCard title="Categories" value={stats.overview.categories} />
        <StatCard title="Readers" value={stats.overview.readers} />
        <StatCard title="Total Views" value={stats.overview.totalViews} />
      </div>

      {/* Articles by Category */}
      <div className="chart-section">
        <h2>Articles by Category</h2>
        <BarChart data={stats.articlesByCategory} />
      </div>

      {/* Top Authors */}
      <div className="table-section">
        <h2>Top Authors</h2>
        <table>
          <thead>
            <tr>
              <th>Author</th>
              <th>Articles</th>
              <th>Total Views</th>
            </tr>
          </thead>
          <tbody>
            {stats.topAuthors.map(author => (
              <tr key={author.authorId}>
                <td>{author.authorId}</td>
                <td>{author.count}</td>
                <td>{author.totalViews.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ title, value }) {
  return (
    <div className="stat-card">
      <h3>{title}</h3>
      <p className="stat-value">{value.toLocaleString()}</p>
    </div>
  );
}
```

### Vue.js Example

```vue
<template>
  <div class="dashboard">
    <h1>News Dashboard</h1>

    <div v-if="loading">Loading...</div>

    <div v-else class="stats-grid">
      <div class="stat-card">
        <h3>Total Articles</h3>
        <p>{{ stats.overview.articles }}</p>
      </div>
      <div class="stat-card">
        <h3>Categories</h3>
        <p>{{ stats.overview.categories }}</p>
      </div>
      <div class="stat-card">
        <h3>Readers</h3>
        <p>{{ stats.overview.readers }}</p>
      </div>
    </div>

    <!-- Articles by Category Chart -->
    <div class="chart-section">
      <h2>Articles by Category</h2>
      <ul>
        <li v-for="cat in stats.articlesByCategory" :key="cat.category">
          {{ cat.category }}: {{ cat.count }} articles
        </li>
      </ul>
    </div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      stats: null,
      loading: true
    };
  },
  async mounted() {
    await this.fetchStats();
  },
  methods: {
    async fetchStats() {
      try {
        const response = await fetch(
          'http://localhost:3000/api/dashboard/my-news-site/stats',
          {
            headers: { 'X-API-Key': 'sk_...' }
          }
        );
        const data = await response.json();
        this.stats = data.data;
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>
```

---

## Performance Tips

### 1. Caching

Cache dashboard stats for better performance:

```javascript
// Backend: Add Redis caching
import Redis from 'ioredis';
const redis = new Redis();

fastify.get("/:projectSlug/stats", async (request, reply) => {
  const cacheKey = `dashboard:stats:${projectSlug}`;

  // Try cache first
  const cached = await redis.get(cacheKey);
  if (cached) {
    return JSON.parse(cached);
  }

  // Fetch fresh data
  const stats = await computeStats(projectSlug);

  // Cache for 5 minutes
  await redis.setex(cacheKey, 300, JSON.stringify(stats));

  return stats;
});
```

### 2. Pagination for Large Results

```javascript
// Add pagination to aggregation
const pageSize = 20;
const page = request.query.page || 1;
const offset = (page - 1) * pageSize;

const query = `
  SELECT ${aggFields.join(', ')}
  FROM "${tablePrefix}_${collection}"
  ${whereClause}
  ${groupByClause}
  LIMIT ${pageSize}
  OFFSET ${offset}
`;
```

### 3. Database Indexes

Add indexes for frequently queried fields:

```sql
-- For articles table
CREATE INDEX idx_articles_category ON articles(category);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_created ON articles("createdAt");
CREATE INDEX idx_articles_author ON articles("authorId");

-- For orders table
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders("createdAt");
CREATE INDEX idx_orders_customer ON orders("customerId");
```

---

## Troubleshooting

### Issue: "Collection not found"

**Solution:** Ensure collection exists and slug is correct:
```bash
# List all collections
curl http://localhost:3000/api/collections?projectId=proj-123 \
  -H "Authorization: Bearer YOUR_JWT"
```

### Issue: "Field does not exist"

**Solution:** Check collection schema:
```bash
# Get collection schema
curl http://localhost:3000/api/collections/coll-id \
  -H "Authorization: Bearer YOUR_JWT"
```

### Issue: Slow query performance

**Solutions:**
1. Add database indexes (see Performance Tips)
2. Use caching for frequently accessed stats
3. Limit result size with pagination
4. Consider database views for complex aggregations

---

**Ready to build powerful analytics dashboards! 📊**
