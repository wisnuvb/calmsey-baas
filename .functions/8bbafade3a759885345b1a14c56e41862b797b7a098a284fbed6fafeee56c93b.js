var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var stdin_exports = {};
__export(stdin_exports, {
  handler: () => handler
});
module.exports = __toCommonJS(stdin_exports);
async function handler(context) {
  const { prisma, request, project, log, error: logError } = context;
  log("Fetching orders summary for project:", project.slug);
  const collectionSlug = "orders";
  const tableName = `data_${project.id.replace(/-/g, "_")}_${collectionSlug}`;
  log("Table name:", tableName);
  try {
    const tableExists = await prisma.$queryRaw`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      ) AS exists
    `;
    if (!tableExists[0]?.exists) {
      return {
        success: false,
        error: `Collection '${collectionSlug}' not found for project ${project.slug}`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
    const recentOrders = await prisma.$queryRawUnsafe(
      `SELECT * FROM "${tableName}" 
       ORDER BY "createdAt" DESC 
       LIMIT 20`
    );
    let totalRevenue = 0;
    const ordersWithRevenue = recentOrders.map((order) => {
      const amount = parseFloat(order.total_amount || order.totalAmount || 0) || 0;
      totalRevenue += amount;
      return {
        ...order,
        total_amount: amount
      };
    });
    log(`Processed ${recentOrders.length} orders with total revenue: ${totalRevenue}`);
    return {
      success: true,
      message: `Summary of last ${recentOrders.length} orders from ${tableName}`,
      summary: {
        total_orders: recentOrders.length,
        total_revenue: totalRevenue,
        average_order_value: recentOrders.length > 0 ? totalRevenue / recentOrders.length : 0,
        collection: collectionSlug,
        project_slug: project.slug,
        project_id: project.id
      },
      recent_orders: ordersWithRevenue,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  } catch (error) {
    logError("Error fetching orders summary:", error.message);
    return {
      success: false,
      error: `Failed to fetch orders summary from ${tableName}`,
      details: error.message,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
}
