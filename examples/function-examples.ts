/**
 * Example Custom Functions for Calmsey BaaS
 *
 * Copy these examples to your dashboard to test custom functions
 */

// ============================================
// Example 1: Hello World
// ============================================
export async function helloWorld(context: any) {
  const { request, log } = context;
  const { name } = request.body;

  log("Hello World function invoked with:", name);

  return {
    success: true,
    message: `Hello, ${name || "World"}!`,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// Example 2: Database Query
// ============================================
export async function listUsers(context: any) {
  const { prisma, project, log } = context;
  const { limit = 10 } = context.request.query;

  log("Fetching users from database");

  try {
    const users = await prisma.$queryRaw`
      SELECT id, name, email, "createdAt"
      FROM "data_${project.id}_users"
      ORDER BY "createdAt" DESC
      LIMIT ${parseInt(limit)}
    `;

    log(`Found ${users.length} users`);

    return {
      success: true,
      data: users,
      count: users.length,
    };
  } catch (error: any) {
    log("Error fetching users:", error.message);
    return {
      success: false,
      error: "Failed to fetch users",
    };
  }
}

// ============================================
// Example 3: Create Record
// ============================================
export async function createUser(context: any) {
  const { prisma, project, request, log } = context;
  const { name, email, age } = request.body;

  // Validation
  if (!name || !email) {
    return {
      success: false,
      error: "Name and email are required",
    };
  }

  if (!email.includes("@")) {
    return {
      success: false,
      error: "Invalid email format",
    };
  }

  log("Creating new user:", { name, email });

  try {
    const result = await prisma.$queryRaw`
      INSERT INTO "data_${project.id}_users" 
        (id, name, email, age, "createdAt", "updatedAt")
      VALUES 
        (gen_random_uuid(), ${name}, ${email}, ${age || null}, NOW(), NOW())
      RETURNING *
    `;

    log("User created successfully");

    return {
      success: true,
      data: result[0],
      message: "User created successfully",
    };
  } catch (error: any) {
    log("Error creating user:", error.message);
    return {
      success: false,
      error: "Failed to create user",
    };
  }
}

// ============================================
// Example 4: Update Record
// ============================================
export async function updateUser(context: any) {
  const { prisma, project, request, log } = context;
  const { id, name, email } = request.body;

  if (!id) {
    return {
      success: false,
      error: "User ID is required",
    };
  }

  log("Updating user:", id);

  try {
    const result = await prisma.$queryRaw`
      UPDATE "data_${project.id}_users"
      SET 
        name = COALESCE(${name}, name),
        email = COALESCE(${email}, email),
        "updatedAt" = NOW()
      WHERE id = ${id}
      RETURNING *
    `;

    if (result.length === 0) {
      return {
        success: false,
        error: "User not found",
      };
    }

    return {
      success: true,
      data: result[0],
      message: "User updated successfully",
    };
  } catch (error: any) {
    log("Error updating user:", error.message);
    return {
      success: false,
      error: "Failed to update user",
    };
  }
}

// ============================================
// Example 5: Complex Business Logic
// ============================================
export async function processOrder(context: any) {
  const { prisma, project, request, log, error } = context;
  const { userId, productId, quantity } = request.body;

  log("Processing order for user:", userId);

  try {
    // 1. Check product stock
    const product = await prisma.$queryRaw`
      SELECT id, name, price, stock
      FROM "data_${project.id}_products"
      WHERE id = ${productId}
    `;

    if (!product || product.length === 0) {
      return { success: false, error: "Product not found" };
    }

    if (product[0].stock < quantity) {
      return {
        success: false,
        error: "Insufficient stock",
        available: product[0].stock,
      };
    }

    // 2. Calculate total
    const total = product[0].price * quantity;
    log("Order total:", total);

    // 3. Create order and reduce stock (transaction)
    await prisma.$executeRaw`
      BEGIN;
      
      INSERT INTO "data_${project.id}_orders" 
        (id, "userId", "productId", quantity, total, status, "createdAt")
      VALUES 
        (gen_random_uuid(), ${userId}, ${productId}, ${quantity}, ${total}, 'pending', NOW());
      
      UPDATE "data_${project.id}_products"
      SET stock = stock - ${quantity}
      WHERE id = ${productId};
      
      COMMIT;
    `;

    log("Order created successfully");

    return {
      success: true,
      message: "Order placed successfully",
      data: {
        productName: product[0].name,
        quantity,
        total,
        remainingStock: product[0].stock - quantity,
      },
    };
  } catch (err: any) {
    error("Order failed:", err.message);

    return {
      success: false,
      error: "Failed to process order",
      details: err.message,
    };
  }
}

// ============================================
// Example 6: Data Aggregation
// ============================================
export async function getStatistics(context: any) {
  const { prisma, project, log } = context;

  log("Calculating statistics");

  try {
    // Get user count
    const userCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM "data_${project.id}_users"
    `;

    // Get product stats
    const productStats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_products,
        SUM(stock) as total_stock,
        AVG(price) as avg_price
      FROM "data_${project.id}_products"
    `;

    // Get recent orders
    const recentOrders = await prisma.$queryRaw`
      SELECT COUNT(*) as count, SUM(total) as revenue
      FROM "data_${project.id}_orders"
      WHERE "createdAt" >= NOW() - INTERVAL '30 days'
    `;

    return {
      success: true,
      data: {
        users: {
          total: parseInt(userCount[0].count),
        },
        products: {
          total: parseInt(productStats[0].total_products || 0),
          totalStock: parseInt(productStats[0].total_stock || 0),
          avgPrice: parseFloat(productStats[0].avg_price || 0),
        },
        orders: {
          last30Days: parseInt(recentOrders[0].count || 0),
          revenue: parseFloat(recentOrders[0].revenue || 0),
        },
      },
    };
  } catch (error: any) {
    log("Error calculating statistics:", error.message);
    return {
      success: false,
      error: "Failed to calculate statistics",
    };
  }
}

// ============================================
// Example 7: Search with Filters
// ============================================
export async function searchProducts(context: any) {
  const { prisma, project, request, log } = context;
  const {
    query,
    minPrice,
    maxPrice,
    inStock = true,
    limit = 20,
  } = request.query;

  log("Searching products with:", { query, minPrice, maxPrice });

  try {
    let sql = `
      SELECT id, name, price, stock, "createdAt"
      FROM "data_${project.id}_products"
      WHERE 1=1
    `;

    const params: any[] = [];

    if (query) {
      sql += ` AND (name ILIKE $${params.length + 1} OR description ILIKE $${
        params.length + 1
      })`;
      params.push(`%${query}%`);
    }

    if (minPrice) {
      sql += ` AND price >= $${params.length + 1}`;
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      sql += ` AND price <= $${params.length + 1}`;
      params.push(parseFloat(maxPrice));
    }

    if (inStock) {
      sql += ` AND stock > 0`;
    }

    sql += ` ORDER BY "createdAt" DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limit));

    const products = await prisma.$queryRawUnsafe(sql, ...params);

    return {
      success: true,
      data: products,
      count: products.length,
    };
  } catch (error: any) {
    log("Search error:", error.message);
    return {
      success: false,
      error: "Search failed",
    };
  }
}

// ============================================
// Example 8: Using Environment Variables
// ============================================
export async function sendNotification(context: any) {
  const { env, request, log, error } = context;
  const { userId, message } = request.body;

  // Get API key from environment
  const apiKey = env.NOTIFICATION_API_KEY;

  if (!apiKey) {
    return {
      success: false,
      error: "Notification API key not configured",
    };
  }

  log("Sending notification to user:", userId);

  try {
    // Simulate external API call
    // const response = await fetch('https://api.notification-service.com/send', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${apiKey}`,
    //     'Content-Type': 'application/json'
    //   },
    //   body: JSON.stringify({ userId, message })
    // });

    log("Notification sent successfully");

    return {
      success: true,
      message: "Notification sent",
      data: { userId, message },
    };
  } catch (err: any) {
    error("Failed to send notification:", err.message);
    return {
      success: false,
      error: "Failed to send notification",
    };
  }
}
