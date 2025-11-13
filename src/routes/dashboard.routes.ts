import { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma";
import { authenticateApiKey } from "../middleware/auth.middleware";

export async function dashboardRoutes(fastify: FastifyInstance) {
  /**
   * Get dashboard statistics for a project
   * Aggregates data from multiple collections
   */
  fastify.get(
    "/:projectSlug/stats",
    { onRequest: [authenticateApiKey] },
    async (request, reply) => {
      const { projectSlug } = request.params as any;
      const project = (request as any).project;

      // Verify project slug
      if (project.slug !== projectSlug) {
        return reply.status(403).send({ success: false, error: "Invalid project" });
      }

      try {
        // Example for news app
        const projectId = project.id;
        const tablePrefix = `data_${projectId.replace(/-/g, "_")}`;

        // Get stats from multiple tables
        const [articlesCount, categoriesCount, readersCount, recentArticles] = await Promise.all([
          // Total articles
          prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as count FROM "${tablePrefix}_articles"
            WHERE "deletedAt" IS NULL
          `),

          // Total categories
          prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as count FROM "${tablePrefix}_categories"
          `),

          // Total readers (unique)
          prisma.$queryRawUnsafe(`
            SELECT COUNT(DISTINCT "userId") as count FROM "${tablePrefix}_readers"
          `),

          // Recent articles (last 7 days)
          prisma.$queryRawUnsafe(`
            SELECT COUNT(*) as count FROM "${tablePrefix}_articles"
            WHERE "createdAt" >= NOW() - INTERVAL '7 days'
            AND "deletedAt" IS NULL
          `)
        ]);

        // Articles by category
        const articlesByCategory = await prisma.$queryRawUnsafe(`
          SELECT
            "category",
            COUNT(*) as count
          FROM "${tablePrefix}_articles"
          WHERE "deletedAt" IS NULL
          GROUP BY "category"
          ORDER BY count DESC
        `);

        // Articles by status
        const articlesByStatus = await prisma.$queryRawUnsafe(`
          SELECT
            "status",
            COUNT(*) as count
          FROM "${tablePrefix}_articles"
          WHERE "deletedAt" IS NULL
          GROUP BY "status"
        `);

        // Top authors
        const topAuthors = await prisma.$queryRawUnsafe(`
          SELECT
            "authorId",
            "authorName",
            COUNT(*) as articleCount
          FROM "${tablePrefix}_articles"
          WHERE "deletedAt" IS NULL
          GROUP BY "authorId", "authorName"
          ORDER BY articleCount DESC
          LIMIT 10
        `);

        // Views/Reads trend (last 30 days)
        const viewsTrend = await prisma.$queryRawUnsafe(`
          SELECT
            DATE("createdAt") as date,
            COUNT(*) as views
          FROM "${tablePrefix}_article_views"
          WHERE "createdAt" >= NOW() - INTERVAL '30 days'
          GROUP BY DATE("createdAt")
          ORDER BY date ASC
        `);

        return reply.send({
          success: true,
          data: {
            overview: {
              totalArticles: Number((articlesCount as any)[0].count),
              totalCategories: Number((categoriesCount as any)[0].count),
              totalReaders: Number((readersCount as any)[0].count),
              recentArticles: Number((recentArticles as any)[0].count)
            },
            articlesByCategory: articlesByCategory,
            articlesByStatus: articlesByStatus,
            topAuthors: topAuthors,
            viewsTrend: viewsTrend
          }
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to fetch dashboard statistics"
        });
      }
    }
  );

  /**
   * Get custom aggregation with flexible query
   */
  fastify.post(
    "/:projectSlug/aggregate",
    { onRequest: [authenticateApiKey] },
    async (request, reply) => {
      const { projectSlug } = request.params as any;
      const { collection, aggregations, filters, groupBy } = request.body as any;
      const project = (request as any).project;

      if (project.slug !== projectSlug) {
        return reply.status(403).send({ success: false, error: "Invalid project" });
      }

      try {
        const projectId = project.id;
        const tableName = `data_${projectId.replace(/-/g, "_")}_${collection}`;

        // Build aggregation query dynamically
        const aggFields = aggregations.map((agg: any) => {
          switch (agg.function) {
            case 'count':
              return `COUNT(${agg.field ? `"${agg.field}"` : '*'}) as ${agg.alias}`;
            case 'sum':
              return `SUM("${agg.field}") as ${agg.alias}`;
            case 'avg':
              return `AVG("${agg.field}") as ${agg.alias}`;
            case 'min':
              return `MIN("${agg.field}") as ${agg.alias}`;
            case 'max':
              return `MAX("${agg.field}") as ${agg.alias}`;
            default:
              return `COUNT(*) as count`;
          }
        }).join(', ');

        const whereClause = filters && Object.keys(filters).length > 0
          ? 'WHERE ' + Object.entries(filters)
              .map(([key, value]) => `"${key}" = '${value}'`)
              .join(' AND ')
          : '';

        const groupByClause = groupBy ? `GROUP BY "${groupBy}"` : '';
        const selectFields = groupBy ? `"${groupBy}", ${aggFields}` : aggFields;

        const query = `
          SELECT ${selectFields}
          FROM "${tableName}"
          ${whereClause}
          ${groupByClause}
        `;

        const result = await prisma.$queryRawUnsafe(query);

        return reply.send({
          success: true,
          data: result
        });
      } catch (error: any) {
        fastify.log.error(error);
        return reply.status(500).send({
          success: false,
          error: "Failed to aggregate data",
          details: error.message
        });
      }
    }
  );
}
