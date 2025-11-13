import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function HelpPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("overview");

  const sections = [
    { id: "overview", title: "📚 Overview", icon: "📚" },
    { id: "collections", title: "🗂️ Collections & Schema", icon: "🗂️" },
    { id: "relations", title: "🔗 Relations", icon: "🔗" },
    { id: "transactions", title: "⚛️ Transactions", icon: "⚛️" },
    { id: "webhooks", title: "🔔 Webhooks", icon: "🔔" },
    { id: "email", title: "📧 Email Service", icon: "📧" },
    { id: "realtime", title: "🔄 Real-time", icon: "🔄" },
    { id: "multidb", title: "🗄️ Multi-Database", icon: "🗄️" },
    { id: "audit", title: "📝 Audit Logs", icon: "📝" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Documentation & Help</h1>
          <p className="mt-1 text-gray-600">Complete guide to Calmsey BaaS features</p>
        </div>
        <Button variant="outline" onClick={() => navigate(-1)}>
          ← Back
        </Button>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Sidebar */}
        <div className="col-span-3">
          <Card className="sticky top-4">
            <nav className="space-y-1">
              {sections.map((section) => (
                <button
                  key={section.id}
                  onClick={() => setActiveTab(section.id)}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${
                    activeTab === section.id
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  {section.icon} {section.title}
                </button>
              ))}
            </nav>
          </Card>
        </div>

        {/* Content */}
        <div className="col-span-9">
          <Card>
            {activeTab === "overview" && (
              <div className="prose max-w-none">
                <h2>🚀 Welcome to Calmsey BaaS</h2>
                <p>
                  Calmsey BaaS adalah Backend as a Service platform yang memungkinkan Anda membuat REST API secara
                  dinamis. Platform ini sudah dilengkapi dengan fitur-fitur enterprise-grade.
                </p>

                <h3>✨ Fitur Utama</h3>
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">🗂️ Dynamic API Generation</h4>
                    <p className="text-sm">Buat REST API otomatis dari schema JSON</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">🔗 Relations</h4>
                    <p className="text-sm">One-to-One, One-to-Many, Many-to-Many</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">⚛️ Transactions</h4>
                    <p className="text-sm">Atomic operations untuk data consistency</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">📝 Audit Logging</h4>
                    <p className="text-sm">Track semua perubahan data</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">🗄️ Multi-Database</h4>
                    <p className="text-sm">Dedicated database per project</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">🔄 Real-time</h4>
                    <p className="text-sm">WebSocket subscriptions</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">🔔 Webhooks</h4>
                    <p className="text-sm">Event-driven integrations</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">📧 Email Service</h4>
                    <p className="text-sm">Transactional emails dengan queue</p>
                  </div>
                </div>

                <h3>🎯 Quick Start</h3>
                <ol>
                  <li><strong>Create Project</strong> - Mulai dengan membuat project baru</li>
                  <li><strong>Define Collection</strong> - Buat schema untuk data Anda</li>
                  <li><strong>Get API Key</strong> - Copy API key dari project settings</li>
                  <li><strong>Use API</strong> - Mulai CRUD data via REST API</li>
                </ol>
              </div>
            )}

            {activeTab === "collections" && (
              <div className="prose max-w-none">
                <h2>🗂️ Collections & Schema</h2>
                <p>Collections adalah table definitions yang mendefinisikan struktur data Anda.</p>

                <h3>Field Types</h3>
                <table className="min-w-full">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Description</th>
                      <th>SQL Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr><td><code>string</code></td><td>Short text</td><td>VARCHAR(255)</td></tr>
                    <tr><td><code>text</code></td><td>Long text</td><td>TEXT</td></tr>
                    <tr><td><code>number</code></td><td>Numeric value</td><td>NUMERIC</td></tr>
                    <tr><td><code>boolean</code></td><td>True/False</td><td>BOOLEAN</td></tr>
                    <tr><td><code>date</code></td><td>Date only</td><td>DATE</td></tr>
                    <tr><td><code>datetime</code></td><td>Date & time</td><td>TIMESTAMP</td></tr>
                    <tr><td><code>email</code></td><td>Email with validation</td><td>VARCHAR(255)</td></tr>
                    <tr><td><code>url</code></td><td>URL with validation</td><td>VARCHAR(500)</td></tr>
                    <tr><td><code>json</code></td><td>JSON object</td><td>JSONB</td></tr>
                    <tr><td><code>relation</code></td><td>Foreign key</td><td>VARCHAR(255)</td></tr>
                    <tr><td><code>file</code></td><td>File path</td><td>VARCHAR(500)</td></tr>
                  </tbody>
                </table>

                <h3>Schema Example</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
{`{
  "fields": [
    {
      "name": "name",
      "type": "string",
      "required": true
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
}`}
                </pre>
              </div>
            )}

            {activeTab === "relations" && (
              <div className="prose max-w-none">
                <h2>🔗 Relations (Foreign Keys)</h2>
                <p>
                  Calmsey BaaS mendukung relasi antar collections, memungkinkan Anda membuat hubungan data yang kompleks.
                </p>

                <h3>Types of Relations</h3>

                <div className="space-y-6 my-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">1. One-to-One (1:1)</h4>
                    <p className="text-sm mb-3">Satu record di collection A berhubungan dengan satu record di collection B.</p>
                    <p className="text-xs text-gray-600">Example: User has one Profile</p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs mt-2">
{`{
  "name": "profileId",
  "type": "relation",
  "relation": {
    "collection": "profiles",
    "type": "one-to-one"
  }
}`}
                    </pre>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">2. One-to-Many (1:M)</h4>
                    <p className="text-sm mb-3">Satu record di collection A berhubungan dengan banyak record di collection B.</p>
                    <p className="text-xs text-gray-600">Example: Customer has many Orders</p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs mt-2">
{`// In Orders collection:
{
  "name": "customerId",
  "type": "relation",
  "relation": {
    "collection": "customers",
    "type": "one-to-many"
  }
}`}
                    </pre>
                  </div>

                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">3. Many-to-Many (M:N)</h4>
                    <p className="text-sm mb-3">Banyak record di collection A berhubungan dengan banyak record di collection B.</p>
                    <p className="text-xs text-gray-600">Example: Post has many Tags, Tag has many Posts</p>
                    <pre className="bg-gray-900 text-gray-100 p-3 rounded text-xs mt-2">
{`// In Posts collection:
{
  "name": "tags",
  "type": "relation",
  "relation": {
    "collection": "tags",
    "type": "many-to-many"
  }
}

// Data stored as JSON array: ["tag1-id", "tag2-id"]`}
                    </pre>
                  </div>
                </div>

                <h3>Using Relations in API</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`// Create with relation
POST /api/data/my-project/orders
{
  "customerName": "John Doe",
  "customerId": "customer-123",  // Foreign key
  "total": 150
}

// Get with populate
GET /api/data/my-project/orders?populate=customerId
// Returns:
{
  "id": "order-1",
  "customerName": "John Doe",
  "customerId": {  // Populated!
    "id": "customer-123",
    "name": "John Doe",
    "email": "john@example.com"
  },
  "total": 150
}`}
                </pre>
              </div>
            )}

            {activeTab === "transactions" && (
              <div className="prose max-w-none">
                <h2>⚛️ Transactions</h2>
                <p>
                  Transactions memastikan multiple operations dieksekusi secara atomic - semua berhasil atau semua gagal.
                  <strong>Critical untuk financial operations, inventory management, dan complex workflows.</strong>
                </p>

                <h3>Why Use Transactions?</h3>
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg my-4">
                  <h4 className="text-red-900 font-semibold mb-2">❌ Without Transaction (DANGEROUS)</h4>
                  <pre className="text-xs bg-red-900 text-white p-2 rounded">
{`1. Deduct $100 from Account A  ✅ Success
2. Add $100 to Account B       ❌ FAILED!
→ Money lost! Account A -$100, Account B +$0`}
                  </pre>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg my-4">
                  <h4 className="text-green-900 font-semibold mb-2">✅ With Transaction (SAFE)</h4>
                  <pre className="text-xs bg-green-900 text-white p-2 rounded">
{`Transaction Start:
1. Deduct $100 from Account A  ✅ Success
2. Add $100 to Account B       ❌ FAILED!
Transaction Rollback → Both operations cancelled
→ Money safe! Both accounts unchanged`}
                  </pre>
                </div>

                <h3>Use Cases</h3>
                <ul>
                  <li>💰 Financial transfers (deduct + add)</li>
                  <li>🛒 E-commerce orders (create order + reduce inventory + create invoice)</li>
                  <li>📝 Multi-step workflows (approval + notification + status update)</li>
                  <li>🔄 Data migrations</li>
                </ul>

                <h3>API Usage</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`// Coming soon: Transaction API endpoint
// For now, use via backend service

import { DynamicQueryBuilder } from './lib/dynamic-query-builder';

await queryBuilder.executeTransaction([
  (prisma) => createOrder(orderData),
  (prisma) => reduceInventory(productId, quantity),
  (prisma) => createInvoice(orderId)
]);
// All succeed or all rollback!`}
                </pre>
              </div>
            )}

            {activeTab === "webhooks" && (
              <div className="prose max-w-none">
                <h2>🔔 Webhooks</h2>
                <p>
                  Webhooks adalah HTTP callbacks yang dipanggil otomatis saat ada event tertentu (create, update, delete).
                  Perfect untuk integrasi dengan sistem lain.
                </p>

                <h3>Setup Webhook</h3>
                <ol>
                  <li>Go to Project Settings → Webhooks tab</li>
                  <li>Click "Create Webhook"</li>
                  <li>Enter webhook URL & select events</li>
                  <li>Test webhook to verify</li>
                </ol>

                <h3>Webhook Payload</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`{
  "event": "onCreate",
  "collection": "orders",
  "action": "create",
  "data": {
    "id": "order-123",
    "customerName": "John Doe",
    "total": 150
  },
  "timestamp": "2024-01-15T10:00:00Z",
  "projectId": "proj-123"
}`}
                </pre>

                <h3>Verifying Signature</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs">
{`// Node.js example
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expected = \`sha256=\${hmac.digest('hex')}\`;
  return signature === expected;
}

app.post('/webhooks', (req, res) => {
  const signature = req.headers['x-webhook-signature'];
  if (!verifyWebhook(req.body, signature, 'your-secret')) {
    return res.status(401).send('Invalid signature');
  }
  // Process webhook...
  res.send('OK');
});`}
                </pre>
              </div>
            )}

            {activeTab === "email" && (
              <div className="prose max-w-none">
                <h2>📧 Email Service</h2>
                <p>Send transactional emails with support for multiple providers (SMTP, SendGrid, Mailgun, AWS SES).</p>

                <h3>Configure Email Provider</h3>
                <ol>
                  <li>Go to Project Settings → Email tab</li>
                  <li>Choose provider (SMTP, SendGrid, etc)</li>
                  <li>Enter credentials</li>
                  <li>Test sending</li>
                </ol>

                <h3>Send Email API</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`POST /api/projects/:projectId/email/send
Authorization: Bearer YOUR_JWT

{
  "to": "customer@example.com",
  "subject": "Order Confirmation",
  "html": "<h1>Thank you!</h1>",
  "text": "Thank you for your order"
}`}
                </pre>

                <h3>Using Templates</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`{
  "to": "customer@example.com",
  "subject": "Order #{{orderNumber}}",
  "template": "<h1>Order {{orderNumber}}</h1><p>Total: ${{total}}</p>",
  "templateData": {
    "orderNumber": "ORD-123",
    "total": "150.00"
  }
}`}
                </pre>
              </div>
            )}

            {activeTab === "realtime" && (
              <div className="prose max-w-none">
                <h2>🔄 Real-time Subscriptions</h2>
                <p>Get live updates when data changes using WebSocket connections. Perfect for dashboards, chat, collaborative apps.</p>

                <h3>Connect to WebSocket</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  // Subscribe to project updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    room: 'project:proj-123'
  }));

  // Subscribe to specific collection
  ws.send(JSON.stringify({
    type: 'subscribe',
    room: 'project:proj-123:collection:orders'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);
  if (msg.event === 'data:create') {
    console.log('New record:', msg.data.record);
    // Update UI in real-time!
  }
};`}
                </pre>

                <h3>Room Patterns</h3>
                <ul>
                  <li><code>project:&#123;id&#125;</code> - All project events</li>
                  <li><code>project:&#123;id&#125;:collection:&#123;slug&#125;</code> - Collection-specific</li>
                  <li><code>project:&#123;id&#125;:collection:&#123;slug&#125;:record:&#123;id&#125;</code> - Record-specific</li>
                </ul>

                <h3>Events</h3>
                <ul>
                  <li><code>data:create</code> - New record created</li>
                  <li><code>data:update</code> - Record updated</li>
                  <li><code>data:delete</code> - Record deleted</li>
                </ul>
              </div>
            )}

            {activeTab === "multidb" && (
              <div className="prose max-w-none">
                <h2>🗄️ Multi-Database Architecture</h2>
                <p>
                  Setiap project bisa memiliki database terpisah untuk true tenant isolation, scalability, dan compliance.
                </p>

                <h3>Benefits</h3>
                <ul>
                  <li>🔒 <strong>True Isolation</strong> - Data completely separated</li>
                  <li>🌍 <strong>Geo-distribution</strong> - Database in different regions</li>
                  <li>📈 <strong>Scalability</strong> - Horizontal scaling per project</li>
                  <li>✅ <strong>Compliance</strong> - Meet data residency requirements</li>
                </ul>

                <h3>Options</h3>
                <div className="space-y-4 my-4">
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-semibold">Option 1: Shared Database (Default)</h4>
                    <p className="text-sm">All projects share same database. Simple, cost-effective.</p>
                  </div>
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-semibold">Option 2: Dedicated DB (Same Server)</h4>
                    <p className="text-sm">Separate database on same server. Better isolation, easy migration.</p>
                  </div>
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-semibold">Option 3: Custom Database Server</h4>
                    <p className="text-sm">Connect to external database. Full control, geo-distribution.</p>
                  </div>
                </div>

                <p className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  💡 <strong>Tip:</strong> Enable "Use Dedicated Database" when creating project for enterprise deployments.
                </p>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="prose max-w-none">
                <h2>📝 Audit Logs</h2>
                <p>
                  Track semua perubahan data untuk compliance, security, dan debugging. Automatic logging of WHO changed WHAT WHEN.
                </p>

                <h3>What's Logged</h3>
                <ul>
                  <li>👤 User/API Key yang melakukan perubahan</li>
                  <li>🎯 Action (CREATE, UPDATE, DELETE)</li>
                  <li>📄 Old & New data snapshots</li>
                  <li>🔄 Changed fields</li>
                  <li>🌐 IP address & User agent</li>
                  <li>⏰ Timestamp</li>
                  <li>🔗 Transaction ID (untuk grouped operations)</li>
                </ul>

                <h3>View Audit Logs</h3>
                <p>Coming soon in Project Settings → Audit Logs tab</p>

                <h3>Query Audit Logs API</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
{`GET /api/projects/:projectId/audit-logs?
  page=1&
  limit=50&
  userId=user-123&
  tableName=orders&
  action=UPDATE&
  startDate=2024-01-01&
  endDate=2024-01-31`}
                </pre>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
