/**
 * News App Dashboard - Complete Example
 *
 * This example shows how to use the dashboard statistics API
 * for a news application with multiple collections.
 */

const API_BASE = 'http://localhost:3000/api';
const API_KEY = 'sk_...'; // Replace with your API key
const PROJECT_SLUG = 'my-news-site';

// ==============================================
// 1. Using Built-in Dashboard Stats Endpoint
// ==============================================

async function getNewsDashboard() {
  try {
    const response = await fetch(
      `${API_BASE}/dashboard/${PROJECT_SLUG}/stats`,
      {
        headers: {
          'X-API-Key': API_KEY
        }
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('📊 Dashboard Statistics:');
      console.log('─────────────────────────────────');
      console.log(`Total Articles: ${result.data.overview.articles}`);
      console.log(`Categories: ${result.data.overview.categories}`);
      console.log(`Readers: ${result.data.overview.readers}`);
      console.log(`Total Views: ${result.data.overview.totalViews}`);
      console.log(`Published Today: ${result.data.overview.publishedToday}`);
      console.log('\n📁 Articles by Category:');
      result.data.articlesByCategory.forEach(cat => {
        console.log(`  ${cat.category}: ${cat.count} articles`);
      });
      console.log('\n✍️ Top Authors:');
      result.data.topAuthors.forEach((author, i) => {
        console.log(`  ${i + 1}. Author ${author.authorId}: ${author.count} articles, ${author.totalViews} views`);
      });

      return result.data;
    }
  } catch (error) {
    console.error('Failed to fetch dashboard:', error);
  }
}

// ==============================================
// 2. Using Flexible Aggregation API
// ==============================================

// Example 1: Count articles by category
async function getArticlesByCategory() {
  try {
    const response = await fetch(
      `${API_BASE}/dashboard/${PROJECT_SLUG}/aggregate`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          collection: 'articles',
          aggregations: [
            {
              function: 'count',
              field: '*',
              alias: 'articleCount'
            },
            {
              function: 'sum',
              field: 'views',
              alias: 'totalViews'
            }
          ],
          groupBy: 'category'
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      console.log('\n📁 Articles by Category (Detailed):');
      console.log('─────────────────────────────────');
      result.data.forEach(cat => {
        console.log(`${cat.category}:`);
        console.log(`  Articles: ${cat.articleCount}`);
        console.log(`  Total Views: ${cat.totalViews}`);
      });

      return result.data;
    }
  } catch (error) {
    console.error('Failed to fetch category stats:', error);
  }
}

// Example 2: Get published articles only with filters
async function getPublishedArticlesStats() {
  try {
    const response = await fetch(
      `${API_BASE}/dashboard/${PROJECT_SLUG}/aggregate`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          collection: 'articles',
          aggregations: [
            {
              function: 'count',
              field: '*',
              alias: 'totalPublished'
            },
            {
              function: 'sum',
              field: 'views',
              alias: 'totalViews'
            },
            {
              function: 'avg',
              field: 'views',
              alias: 'avgViews'
            }
          ],
          filters: [
            {
              field: 'status',
              operator: '=',
              value: 'published'
            }
          ]
        })
      }
    );

    const result = await response.json();

    if (result.success && result.data.length > 0) {
      const stats = result.data[0];
      console.log('\n📰 Published Articles Statistics:');
      console.log('─────────────────────────────────');
      console.log(`Total Published: ${stats.totalPublished}`);
      console.log(`Total Views: ${stats.totalViews}`);
      console.log(`Average Views: ${Math.round(stats.avgViews)}`);

      return stats;
    }
  } catch (error) {
    console.error('Failed to fetch published articles stats:', error);
  }
}

// Example 3: Get reader statistics
async function getReaderStats() {
  try {
    const response = await fetch(
      `${API_BASE}/dashboard/${PROJECT_SLUG}/aggregate`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          collection: 'readers',
          aggregations: [
            {
              function: 'count',
              field: '*',
              alias: 'totalReaders'
            }
          ]
        })
      }
    );

    const result = await response.json();

    if (result.success && result.data.length > 0) {
      console.log('\n👥 Reader Statistics:');
      console.log('─────────────────────────────────');
      console.log(`Total Readers: ${result.data[0].totalReaders}`);

      return result.data[0];
    }
  } catch (error) {
    console.error('Failed to fetch reader stats:', error);
  }
}

// Example 4: Get top authors
async function getTopAuthors() {
  try {
    const response = await fetch(
      `${API_BASE}/dashboard/${PROJECT_SLUG}/aggregate`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          collection: 'articles',
          aggregations: [
            {
              function: 'count',
              field: '*',
              alias: 'articleCount'
            },
            {
              function: 'sum',
              field: 'views',
              alias: 'totalViews'
            }
          ],
          filters: [
            {
              field: 'status',
              operator: '=',
              value: 'published'
            }
          ],
          groupBy: 'authorId'
        })
      }
    );

    const result = await response.json();

    if (result.success) {
      // Sort by article count descending
      const topAuthors = result.data
        .sort((a, b) => b.articleCount - a.articleCount)
        .slice(0, 10);

      console.log('\n✍️ Top 10 Authors:');
      console.log('─────────────────────────────────');
      topAuthors.forEach((author, i) => {
        console.log(`${i + 1}. Author ${author.authorId}:`);
        console.log(`   Articles: ${author.articleCount}`);
        console.log(`   Total Views: ${author.totalViews}`);
      });

      return topAuthors;
    }
  } catch (error) {
    console.error('Failed to fetch top authors:', error);
  }
}

// ==============================================
// 3. Complete Dashboard Data Fetch
// ==============================================

async function fetchCompleteDashboard() {
  console.log('🚀 Fetching News Dashboard Data...\n');

  // Approach 1: Use built-in stats endpoint (faster, single request)
  const dashboardStats = await getNewsDashboard();

  // Approach 2: Use flexible aggregation for custom queries
  console.log('\n\n📊 Fetching Additional Custom Statistics...\n');

  const [categoryStats, publishedStats, readerStats, topAuthors] = await Promise.all([
    getArticlesByCategory(),
    getPublishedArticlesStats(),
    getReaderStats(),
    getTopAuthors()
  ]);

  return {
    overview: dashboardStats?.overview,
    categories: categoryStats,
    published: publishedStats,
    readers: readerStats,
    topAuthors: topAuthors
  };
}

// ==============================================
// 4. React Component Example
// ==============================================

/*
import React, { useEffect, useState } from 'react';

function NewsDashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(
        `${API_BASE}/dashboard/${PROJECT_SLUG}/stats`,
        {
          headers: { 'X-API-Key': API_KEY }
        }
      );
      const result = await response.json();
      if (result.success) {
        setStats(result.data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="dashboard">
      <h1>News Dashboard</h1>

      <div className="stats-grid">
        <StatCard
          title="Total Articles"
          value={stats.overview.articles}
          icon="📰"
        />
        <StatCard
          title="Categories"
          value={stats.overview.categories}
          icon="📁"
        />
        <StatCard
          title="Readers"
          value={stats.overview.readers}
          icon="👥"
        />
        <StatCard
          title="Total Views"
          value={stats.overview.totalViews.toLocaleString()}
          icon="👀"
        />
      </div>

      <div className="chart-section">
        <h2>Articles by Category</h2>
        <BarChart data={stats.articlesByCategory} />
      </div>

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

function StatCard({ title, value, icon }) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <h3>{title}</h3>
      <p className="stat-value">{value}</p>
    </div>
  );
}

export default NewsDashboard;
*/

// ==============================================
// Run the examples
// ==============================================

if (typeof window === 'undefined') {
  // Node.js environment
  fetchCompleteDashboard().then(() => {
    console.log('\n✅ Dashboard data fetched successfully!');
  }).catch(error => {
    console.error('❌ Error:', error);
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getNewsDashboard,
    getArticlesByCategory,
    getPublishedArticlesStats,
    getReaderStats,
    getTopAuthors,
    fetchCompleteDashboard
  };
}
