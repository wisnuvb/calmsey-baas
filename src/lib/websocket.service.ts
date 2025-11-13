import { FastifyInstance } from "fastify";
import { WebSocket } from "ws";

export interface WebSocketMessage {
  type: "subscribe" | "unsubscribe" | "data" | "error" | "ping" | "pong";
  event?: string;
  room?: string;
  data?: any;
}

export interface WebSocketClient {
  ws: WebSocket;
  projectId?: string;
  rooms: Set<string>;
  isAlive: boolean;
}

/**
 * WebSocket Real-time Service
 * Manages real-time subscriptions and broadcasts
 */
export class WebSocketService {
  private clients: Map<string, WebSocketClient> = new Map();
  private rooms: Map<string, Set<string>> = new Map(); // room -> Set of client IDs

  constructor() {
    // Start heartbeat interval
    setInterval(() => this.heartbeat(), 30000); // 30 seconds
  }

  /**
   * Register a new WebSocket client
   */
  registerClient(clientId: string, ws: WebSocket, projectId?: string): void {
    const client: WebSocketClient = {
      ws,
      projectId,
      rooms: new Set(),
      isAlive: true,
    };

    this.clients.set(clientId, client);

    // Setup ping/pong for connection monitoring
    ws.on("pong", () => {
      const c = this.clients.get(clientId);
      if (c) c.isAlive = true;
    });

    ws.on("close", () => {
      this.removeClient(clientId);
    });

    ws.on("message", (message) => {
      this.handleMessage(clientId, message.toString());
    });

    // Send welcome message
    this.sendToClient(clientId, {
      type: "data",
      event: "connected",
      data: { clientId, message: "Connected to Calmsey BaaS real-time server" },
    });
  }

  /**
   * Remove a client
   */
  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    // Remove from all rooms
    client.rooms.forEach((room) => {
      this.leaveRoom(clientId, room);
    });

    this.clients.delete(clientId);
  }

  /**
   * Subscribe client to a room
   */
  subscribe(clientId: string, room: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.rooms.add(room);

    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }

    this.rooms.get(room)!.add(clientId);

    this.sendToClient(clientId, {
      type: "data",
      event: "subscribed",
      room,
      data: { message: `Subscribed to ${room}` },
    });
  }

  /**
   * Unsubscribe client from a room
   */
  unsubscribe(clientId: string, room: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.rooms.delete(room);
    this.leaveRoom(clientId, room);

    this.sendToClient(clientId, {
      type: "data",
      event: "unsubscribed",
      room,
      data: { message: `Unsubscribed from ${room}` },
    });
  }

  /**
   * Leave a room
   */
  private leaveRoom(clientId: string, room: string): void {
    const roomClients = this.rooms.get(room);
    if (roomClients) {
      roomClients.delete(clientId);
      if (roomClients.size === 0) {
        this.rooms.delete(room);
      }
    }
  }

  /**
   * Broadcast to a room
   */
  broadcast(room: string, event: string, data: any): void {
    const roomClients = this.rooms.get(room);
    if (!roomClients) return;

    const message: WebSocketMessage = {
      type: "data",
      event,
      room,
      data,
    };

    roomClients.forEach((clientId) => {
      this.sendToClient(clientId, message);
    });
  }

  /**
   * Broadcast data change event
   */
  broadcastDataChange(
    projectId: string,
    collectionSlug: string,
    action: "create" | "update" | "delete",
    record: any
  ): void {
    // Broadcast to project-wide listeners
    this.broadcast(`project:${projectId}`, `data:${action}`, {
      collection: collectionSlug,
      action,
      record,
      timestamp: new Date().toISOString(),
    });

    // Broadcast to collection-specific listeners
    this.broadcast(
      `project:${projectId}:collection:${collectionSlug}`,
      `data:${action}`,
      {
        action,
        record,
        timestamp: new Date().toISOString(),
      }
    );

    // Broadcast to record-specific listeners (for updates/deletes)
    if (action !== "create" && record.id) {
      this.broadcast(
        `project:${projectId}:collection:${collectionSlug}:record:${record.id}`,
        `data:${action}`,
        {
          action,
          record,
          timestamp: new Date().toISOString(),
        }
      );
    }
  }

  /**
   * Send message to a specific client
   */
  private sendToClient(clientId: string, message: WebSocketMessage): void {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Failed to send message to client ${clientId}:`, error);
    }
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(clientId: string, messageStr: string): void {
    try {
      const message: WebSocketMessage = JSON.parse(messageStr);

      switch (message.type) {
        case "subscribe":
          if (message.room) {
            this.subscribe(clientId, message.room);
          }
          break;

        case "unsubscribe":
          if (message.room) {
            this.unsubscribe(clientId, message.room);
          }
          break;

        case "ping":
          this.sendToClient(clientId, { type: "pong" });
          break;

        default:
          this.sendToClient(clientId, {
            type: "error",
            data: { message: `Unknown message type: ${message.type}` },
          });
      }
    } catch (error) {
      this.sendToClient(clientId, {
        type: "error",
        data: { message: "Invalid message format" },
      });
    }
  }

  /**
   * Heartbeat to detect dead connections
   */
  private heartbeat(): void {
    this.clients.forEach((client, clientId) => {
      if (!client.isAlive) {
        client.ws.terminate();
        this.removeClient(clientId);
        return;
      }

      client.isAlive = false;
      client.ws.ping();
    });
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      totalRooms: this.rooms.size,
      rooms: Array.from(this.rooms.entries()).map(([room, clients]) => ({
        room,
        subscribers: clients.size,
      })),
    };
  }
}

// Global singleton instance
export const websocketService = new WebSocketService();
