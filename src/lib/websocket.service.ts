import { WebSocket } from "ws";

type Listener = (event: string, payload: any) => void;

interface Subscription {
  ws: WebSocket;
  channels: Set<string>; // Set of channels this connection is subscribed to
}

export class WebSocketService {
  private static instance: WebSocketService;
  private subscriptions: Map<WebSocket, Subscription> = new Map();

  private constructor() {}

  static getInstance(): WebSocketService {
    if (!WebSocketService.instance) {
      WebSocketService.instance = new WebSocketService();
    }
    return WebSocketService.instance;
  }

  handleConnection(ws: WebSocket) {
    this.subscriptions.set(ws, { ws, channels: new Set() });

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        this.handleMessage(ws, data);
      } catch (e) {
        console.error("Invalid websocket message", e);
      }
    });

    ws.on("close", () => {
      this.subscriptions.delete(ws);
    });
  }

  private handleMessage(ws: WebSocket, message: any) {
    const sub = this.subscriptions.get(ws);
    if (!sub) return;

    // Supabase-like protocol: { type: 'subscribe', channel: '...' }
    // Or our simple custom one

    if (message.type === "subscribe" && message.channel) {
      sub.channels.add(message.channel);
      ws.send(
        JSON.stringify({
          type: "system",
          event: "subscribed",
          channel: message.channel,
        })
      );
    } else if (message.type === "unsubscribe" && message.channel) {
      sub.channels.delete(message.channel);
      ws.send(
        JSON.stringify({
          type: "system",
          event: "unsubscribed",
          channel: message.channel,
        })
      );
    }
  }

  /**
   * Broadcast an event to all subscribers of a channel
   */
  broadcast(channel: string, event: string, payload: any) {
    const message = JSON.stringify({
      channel,
      event,
      payload,
      timestamp: new Date().toISOString(),
    });

    this.subscriptions.forEach((sub) => {
      if (sub.channels.has(channel)) {
        if (sub.ws.readyState === WebSocket.OPEN) {
          sub.ws.send(message);
        }
      }
    });
  }
}
