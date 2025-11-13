# Real-time, Webhooks & Email - Calmsey BaaS

Complete guide for Real-time Subscriptions, Webhooks, and Email services.

## Table of Contents

1. [Real-time Subscriptions (WebSocket)](#real-time-subscriptions)
2. [Webhooks](#webhooks)
3. [Email Service](#email-service)
4. [Quick Start Examples](#quick-start-examples)

---

## Real-time Subscriptions

### Overview

WebSocket-based real-time updates for data changes. Perfect for:
- Live dashboards
- Collaborative apps
- Real-time notifications
- Chat applications

### Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  console.log('Connected to real-time server');

  // Subscribe to project updates
  ws.send(JSON.stringify({
    type: 'subscribe',
    room: 'project:proj-123'
  }));

  // Subscribe to specific collection
  ws.send(JSON.stringify({
    type: 'subscribe',
    room: 'project:proj-123:collection:products'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Received:', message);

  if (message.event === 'data:create') {
    console.log('New record created:', message.data.record);
  }
};
```

### Room Patterns

```
project:{projectId}                                    // All project events
project:{projectId}:collection:{slug}                  // Collection events
project:{projectId}:collection:{slug}:record:{id}      // Specific record
```

### Events

- `data:create` - New record created
- `data:update` - Record updated
- `data:delete` - Record deleted

---

## Webhooks

### Setup

```http
POST /api/projects/:projectId/webhooks
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "name": "Order Notifications",
  "url": "https://your-app.com/webhooks/orders",
  "events": ["onCreate", "onUpdate"],
  "secret": "your-webhook-secret",
  "maxRetries": 3
}
```

### Events

- `onCreate` - Record created
- `onUpdate` - Record updated
- `onDelete` - Record deleted
- `*` - All events

### Payload

```json
{
  "event": "onCreate",
  "collection": "orders",
  "action": "create",
  "data": {
    "id": "ord-123",
    "customer": "John Doe",
    "total": 150
  },
  "timestamp": "2024-01-15T10:00:00Z",
  "projectId": "proj-123"
}
```

### Signature Verification

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(payload));
  const expected = `sha256=${hmac.digest('hex')}`;

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expected)
  );
}

// In your webhook endpoint:
app.post('/webhooks/orders', (req, res) => {
  const signature = req.headers['x-webhook-signature'];

  if (!verifyWebhook(req.body, signature, 'your-webhook-secret')) {
    return res.status(401).send('Invalid signature');
  }

  // Process webhook
  console.log('Valid webhook:', req.body);
  res.status(200).send('OK');
});
```

### Test Webhook

```http
POST /api/webhooks/:id/test
Authorization: Bearer {jwt}
```

---

## Email Service

### Configure Email Provider

```http
PATCH /api/projects/:projectId/email/settings
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "emailEnabled": true,
  "emailProvider": "smtp",
  "emailConfig": {
    "provider": "smtp",
    "host": "smtp.gmail.com",
    "port": 587,
    "auth": {
      "user": "your-email@gmail.com",
      "pass": "your-app-password"
    },
    "from": "noreply@yourapp.com"
  }
}
```

### Send Email

```http
POST /api/projects/:projectId/email/send
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "to": "customer@example.com",
  "subject": "Welcome to Our App",
  "html": "<h1>Welcome!</h1><p>Thanks for signing up.</p>",
  "text": "Welcome! Thanks for signing up."
}
```

### Using Templates

```http
POST /api/projects/:projectId/email/send
Authorization: Bearer {jwt}
Content-Type: application/json

{
  "to": "customer@example.com",
  "subject": "Order Confirmation",
  "template": "<h1>Order {{orderNumber}}</h1><p>Total: ${{total}}</p>",
  "templateData": {
    "orderNumber": "ORD-123",
    "total": "150.00"
  }
}
```

### Email Stats

```http
GET /api/projects/:projectId/email/stats
Authorization: Bearer {jwt}
```

Response:
```json
{
  "success": true,
  "data": {
    "total": 1500,
    "sent": 1450,
    "failed": 50,
    "pending": 0,
    "successRate": "96.67"
  }
}
```

---

## Quick Start Examples

### 1. Live Dashboard

```javascript
// Frontend
const ws = new WebSocket('ws://localhost:3000/ws');

ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'subscribe',
    room: 'project:proj-123:collection:orders'
  }));
};

ws.onmessage = (event) => {
  const msg = JSON.parse(event.data);

  if (msg.event === 'data:create') {
    // Add new order to dashboard
    addOrderToList(msg.data.record);
  }
};
```

### 2. Email on Order Create

**Backend (Webhook endpoint):**

```javascript
app.post('/webhooks/orders', async (req, res) => {
  const { event, data } = req.body;

  if (event === 'onCreate') {
    // Send confirmation email
    await fetch('http://localhost:3000/api/projects/proj-123/email/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer YOUR_JWT',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: data.customerEmail,
        subject: `Order Confirmation #${data.orderNumber}`,
        template: orderConfirmationTemplate,
        templateData: data
      })
    });
  }

  res.status(200).send('OK');
});
```

### 3. Complete E-commerce Flow

```javascript
// 1. Customer places order (via API)
const order = await fetch('/api/data/my-shop/orders', {
  method: 'POST',
  headers: { 'X-API-Key': 'sk_...' },
  body: JSON.stringify({
    customerEmail: 'john@example.com',
    items: [...],
    total: 150
  })
});

// 2. Webhook triggers automatically
// Your webhook endpoint receives onCreate event

// 3. Send confirmation email
await sendEmail({
  to: order.customerEmail,
  subject: 'Order Confirmation',
  template: 'order-confirmation',
  data: order
});

// 4. Real-time update to admin dashboard
// WebSocket broadcasts to admin:
// { event: 'data:create', collection: 'orders', record: order }

// 5. Admin sees new order instantly!
```

---

## Environment Variables

Add to `.env`:

```env
# Redis (optional, for email queue)
REDIS_URL=redis://localhost:6379

# Email settings
EMAIL_CONCURRENCY=5

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
```

---

## Migration

Run migration to add new models:

```bash
npm run prisma:generate
npm run prisma:migrate
```

---

## Best Practices

### WebSocket
- Subscribe only to rooms you need
- Implement reconnection logic
- Handle connection errors gracefully

### Webhooks
- Always verify signatures
- Return 200 OK quickly (process async)
- Implement idempotency for safety
- Log all webhook deliveries

### Email
- Use templates for consistency
- Queue emails for better performance
- Monitor delivery rates
- Handle bounces and failures

---

## Troubleshooting

### WebSocket Not Connecting
- Check firewall/proxy settings
- Ensure WebSocket is enabled in server
- Verify correct URL (ws:// not http://)

### Webhook Not Triggering
- Check webhook is active
- Verify events match
- Check webhook logs for errors

### Email Not Sending
- Verify email configuration
- Check SMTP credentials
- Review email logs for errors
- Test with webhook test endpoint

---

**Complete! Your BaaS now supports real-time, webhooks, and email! 🚀**
