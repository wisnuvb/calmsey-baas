import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Card from "../components/ui/Card";
import Button from "../components/ui/Button";

export default function HelpPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<string>("overview");

  const sections = [
    { id: "overview", title: "Overview", icon: "📚" },
    { id: "collections", title: "Collections & Schema", icon: "🗂️" },
    { id: "relations", title: "Relations", icon: "🔗" },
    { id: "transactions", title: "Transactions", icon: "⚛️" },
    { id: "webhooks", title: "Webhooks", icon: "🔔" },
    { id: "email", title: "Email Service", icon: "📧" },
    { id: "realtime", title: "Real-time", icon: "🔄" },
    { id: "multidb", title: "Multi-Database", icon: "🗄️" },
    { id: "audit", title: "Audit Logs", icon: "📝" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Documentation & Help
          </h1>
          <p className="mt-1 text-gray-600">
            Complete guide to Calmsey BaaS features
          </p>
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
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">
                  🚀 Welcome to Calmsey BaaS
                </h2>
                <p>
                  Calmsey BaaS is Backend as a Service platform that allows you
                  to create REST API dynamically based on the defined schema.
                  This platform is already equipped with enterprise-grade
                  features.
                </p>

                <h3 className="text-xl font-medium">✨ Main Features</h3>
                <div className="grid grid-cols-2 gap-4 my-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">
                      Dynamic API Generation
                    </h4>
                    <p className="text-sm">
                      Create REST API automatically from JSON schema
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Relations</h4>
                    <p className="text-sm">
                      One-to-One, One-to-Many, Many-to-Many relations
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Transactions</h4>
                    <p className="text-sm">
                      Atomic operations for data consistency
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Audit Logging</h4>
                    <p className="text-sm">Track all data changes</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Multi-Database</h4>
                    <p className="text-sm">
                      Dedicated database per project for true tenant isolation,
                      scalability, and compliance
                    </p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Real-time</h4>
                    <p className="text-sm">WebSocket subscriptions</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Webhooks</h4>
                    <p className="text-sm">Event-driven integrations</p>
                  </div>
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-semibold mb-2">Email Service</h4>
                    <p className="text-sm">Transactional emails with queue</p>
                  </div>
                </div>

                <h3 className="text-xl font-medium">🎯 Quick Start</h3>
                <ol className="list-disc list-inside space-y-2 text-base">
                  <li>
                    <strong>Create Project</strong> - Start by creating a new
                    project
                  </li>
                  <li>
                    <strong>Define Collection</strong> - Create schema for your
                    data
                  </li>
                  <li>
                    <strong>Get API Key</strong> - Copy API key from project
                    settings
                  </li>
                  <li>
                    <strong>Use API</strong> - Start CRUD data via REST API
                  </li>
                </ol>
              </div>
            )}

            {activeTab === "collections" && (
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">🗂️ Collections & Schema</h2>
                <p>
                  Collections are table definitions that define your data
                  structure.
                </p>

                <h3 className="text-xl font-medium">Field Types</h3>
                <table className="min-w-full text-base table-auto border-collapse border border-gray-200">
                  <thead>
                    <tr>
                      <th className="text-left border border-gray-200 p-2">
                        Type
                      </th>
                      <th className="text-left border border-gray-200 p-2">
                        Description
                      </th>
                      <th className="text-left border border-gray-200 p-2">
                        SQL Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>string</code>
                      </td>
                      <td className="border border-gray-200 p-2">Short text</td>
                      <td className="border border-gray-200 p-2">
                        VARCHAR(255)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>text</code>
                      </td>
                      <td className="border border-gray-200 p-2">Long text</td>
                      <td className="border border-gray-200 p-2">TEXT</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>number</code>
                      </td>
                      <td className="border border-gray-200 p-2">
                        Numeric value
                      </td>
                      <td className="border border-gray-200 p-2">NUMERIC</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>boolean</code>
                      </td>
                      <td className="border border-gray-200 p-2">True/False</td>
                      <td className="border border-gray-200 p-2">BOOLEAN</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>date</code>
                      </td>
                      <td className="border border-gray-200 p-2">Date only</td>
                      <td className="border border-gray-200 p-2">DATE</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>datetime</code>
                      </td>
                      <td className="border border-gray-200 p-2">
                        Date & time
                      </td>
                      <td className="border border-gray-200 p-2">TIMESTAMP</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>email</code>
                      </td>
                      <td className="border border-gray-200 p-2">
                        Email with validation
                      </td>
                      <td className="border border-gray-200 p-2">
                        VARCHAR(255)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>url</code>
                      </td>
                      <td className="border border-gray-200 p-2">
                        URL with validation
                      </td>
                      <td className="border border-gray-200 p-2">
                        VARCHAR(500)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>json</code>
                      </td>
                      <td className="border border-gray-200 p-2">
                        JSON object
                      </td>
                      <td className="border border-gray-200 p-2">JSONB</td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>relation</code>
                      </td>
                      <td className="border border-gray-200 p-2">
                        Foreign key
                      </td>
                      <td className="border border-gray-200 p-2">
                        VARCHAR(255)
                      </td>
                    </tr>
                    <tr>
                      <td className="border border-gray-200 p-2">
                        <code>file</code>
                      </td>
                      <td className="border border-gray-200 p-2">File path</td>
                      <td className="border border-gray-200 p-2">
                        VARCHAR(500)
                      </td>
                    </tr>
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
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">
                  🔗 Relations (Foreign Keys)
                </h2>
                <p>
                  Calmsey BaaS supports relations between collections, allowing
                  you to create complex data relationships.
                </p>

                <h3>Types of Relations</h3>

                <div className="space-y-6 my-6">
                  <div className="border border-gray-200 rounded-lg p-4">
                    <h4 className="font-semibold mb-2">1. One-to-One (1:1)</h4>
                    <p className="text-sm mb-3">
                      One record in collection A is related to one record in
                      collection B.
                    </p>
                    <p className="text-xs text-gray-600">
                      Example: User has one Profile
                    </p>
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
                    <p className="text-sm mb-3">
                      One record in collection A is related to many records in
                      collection B.
                    </p>
                    <p className="text-xs text-gray-600">
                      Example: Customer has many Orders
                    </p>
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
                    <h4 className="font-semibold mb-2">
                      3. Many-to-Many (M:N)
                    </h4>
                    <p className="text-sm mb-3">
                      Many records in collection A are related to many records
                      in collection B.
                    </p>
                    <p className="text-xs text-gray-600">
                      Example: Post has many Tags, Tag has many Posts
                    </p>
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
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">⚛️ Transactions</h2>
                <p>
                  Transactions makes sure multiple operations are executed
                  atomically - all succeed or all fail. atomic - all or nothing
                  execution.{" "}
                  <strong>
                    Critical for financial operations, inventory management, and
                    complex workflows.
                  </strong>
                </p>

                <h3 className="text-xl font-medium">Why Use Transactions?</h3>
                <div className="bg-red-50 border border-red-200 p-4 rounded-lg my-4">
                  <h4 className="text-red-900 font-semibold mb-2">
                    ❌ Without Transaction (DANGEROUS)
                  </h4>
                  <pre className="text-xs bg-red-900 text-white p-2 rounded">
                    {`1. Deduct $100 from Account A  ✅ Success
2. Add $100 to Account B       ❌ FAILED!
→ Money lost! Account A -$100, Account B +$0`}
                  </pre>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-lg my-4">
                  <h4 className="text-green-900 font-semibold mb-2">
                    ✅ With Transaction (SAFE)
                  </h4>
                  <pre className="text-xs bg-green-900 text-white p-2 rounded">
                    {`Transaction Start:
1. Deduct $100 from Account A  ✅ Success
2. Add $100 to Account B       ❌ FAILED!
Transaction Rollback → Both operations cancelled
→ Money safe! Both accounts unchanged`}
                  </pre>
                </div>

                <h3 className="text-xl font-medium">Use Cases</h3>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>💰 Financial transfers (deduct + add)</li>
                  <li>
                    🛒 E-commerce orders (create order + reduce inventory +
                    create invoice)
                  </li>
                  <li>
                    📝 Multi-step workflows (approval + notification + status
                    update)
                  </li>
                  <li>🔄 Data migrations</li>
                </ul>

                <h3 className="text-xl font-medium">API Usage</h3>
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
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">🔔 Webhooks</h2>
                <p>
                  Webhooks are HTTP callbacks that are called automatically when
                  a specific event occurs (create, update, delete). Perfect for
                  integration with other systems.
                </p>

                <h3 className="text-xl font-medium">Setup Webhook</h3>
                <ol className="list-decimal list-inside space-y-2 text-base">
                  <li>Go to Project Settings → Webhooks tab</li>
                  <li>Click "Create Webhook"</li>
                  <li>Enter webhook URL & select events</li>
                  <li>Test webhook to verify</li>
                </ol>

                <h3 className="text-xl font-medium">Webhook Payload</h3>
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

                <h3 className="text-xl font-medium">Verifying Signature</h3>
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
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">📧 Email Service</h2>
                <p>
                  Send transactional emails with support for multiple providers
                  (SMTP, SendGrid, Mailgun, AWS SES).
                </p>

                <h3 className="text-xl font-medium">
                  Configure Email Provider
                </h3>
                <ol className="list-decimal list-inside space-y-2 text-base">
                  <li>Go to Project Settings → Email tab</li>
                  <li>Choose provider (SMTP, SendGrid, etc)</li>
                  <li>Enter credentials</li>
                  <li>Test sending</li>
                </ol>

                <h3 className="text-xl font-medium">Send Email API</h3>
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

                <h3 className="text-xl font-medium">Using Templates</h3>
                <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg">
                  {`{
  "to": "customer@example.com",
  "subject": "Order #{{orderNumber}}",
  "template": "<h1>Order {{orderNumber}}</h1><p>Total: {{ total }}</p>",
  "templateData": {
    "orderNumber": "ORD-123",
    "total": "150.00"
  }
}`}
                </pre>
              </div>
            )}

            {activeTab === "realtime" && (
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">
                  🔄 Real-time Subscriptions
                </h2>
                <p>
                  Get live updates when data changes using WebSocket
                  connections. Perfect for dashboards, chat, collaborative apps.
                </p>

                <h3 className="text-xl font-medium">Connect to WebSocket</h3>
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

                <h3 className="text-xl font-medium">Room Patterns</h3>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>
                    <code>project:&#123;id&#125;</code> - All project events
                  </li>
                  <li>
                    <code>
                      project:&#123;id&#125;:collection:&#123;slug&#125;
                    </code>{" "}
                    - Collection-specific
                  </li>
                  <li>
                    <code>
                      project:&#123;id&#125;:collection:&#123;slug&#125;:record:&#123;id&#125;
                    </code>{" "}
                    - Record-specific
                  </li>
                </ul>

                <h3 className="text-xl font-medium">Events</h3>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>
                    <code>data:create</code> - New record created
                  </li>
                  <li>
                    <code>data:update</code> - Record updated
                  </li>
                  <li>
                    <code>data:delete</code> - Record deleted
                  </li>
                </ul>
              </div>
            )}

            {activeTab === "multidb" && (
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">
                  🗄️ Multi-Database Architecture
                </h2>
                <p>
                  Each project can have a separate database for true tenant
                  isolation, scalability, and compliance.
                </p>

                <h3 className="text-xl font-medium">Benefits</h3>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>
                    🔒 <strong>True Isolation</strong> - Data completely
                    separated
                  </li>
                  <li>
                    🌍 <strong>Geo-distribution</strong> - Database in different
                    regions
                  </li>
                  <li>
                    📈 <strong>Scalability</strong> - Horizontal scaling per
                    project
                  </li>
                  <li>
                    ✅ <strong>Compliance</strong> - Meet data residency
                    requirements
                  </li>
                </ul>

                <h3 className="text-xl font-medium">Options</h3>
                <div className="space-y-4 my-4">
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-semibold">
                      Option 1: Shared Database (Default)
                    </h4>
                    <p className="text-sm">
                      All projects share same database. Simple, cost-effective.
                    </p>
                  </div>
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-semibold">
                      Option 2: Dedicated DB (Same Server)
                    </h4>
                    <p className="text-sm">
                      Separate database on same server. Better isolation, easy
                      migration.
                    </p>
                  </div>
                  <div className="border p-4 rounded-lg">
                    <h4 className="font-semibold">
                      Option 3: Custom Database Server
                    </h4>
                    <p className="text-sm">
                      Connect to external database. Full control,
                      geo-distribution.
                    </p>
                  </div>
                </div>

                <p className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                  💡 <strong>Tip:</strong> Enable "Use Dedicated Database" when
                  creating project for enterprise deployments.
                </p>
              </div>
            )}

            {activeTab === "audit" && (
              <div className="prose max-w-none space-y-4">
                <h2 className="text-2xl font-bold">📝 Audit Logs</h2>
                <p>
                  Track all data changes for compliance, security, and
                  debugging. debugging. Automatic logging of WHO changed WHAT
                  WHEN.
                </p>

                <h3 className="text-xl font-medium">What's Logged</h3>
                <ul className="list-disc list-inside space-y-2 text-base">
                  <li>👤 User/API Key that made the change</li>
                  <li>🎯 Action (CREATE, UPDATE, DELETE)</li>
                  <li>📄 Old & New data snapshots</li>
                  <li>🔄 Changed fields</li>
                  <li>🌐 IP address & User agent</li>
                  <li>⏰ Timestamp</li>
                  <li>🔗 Transaction ID (for grouped operations)</li>
                </ul>

                <h3 className="text-xl font-medium">View Audit Logs</h3>
                <p>Coming soon in Project Settings → Audit Logs tab</p>

                <h3 className="text-xl font-medium">Query Audit Logs API</h3>
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
