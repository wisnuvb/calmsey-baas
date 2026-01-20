import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import { Collection, Project } from "../types";
import { Button } from "./ui/Button";
import Card from "./ui/Card";
import { Activity, Radio, Wifi, Trash2 } from "lucide-react";

interface RealtimeTesterProps {
  project: Project;
  collection: Collection;
}

type EventType = "INSERT" | "UPDATE" | "DELETE" | "system";

interface EventLog {
  id: string;
  type: EventType;
  payload: unknown;
  timestamp: string;
  formattedPayload?: string; // Pre-stringify untuk performance
}

type ConnectionState = 'disconnected' | 'connecting' | 'connected';

const MAX_LOGS = 50;
const MAX_RECONNECT_ATTEMPTS = 5;
const INITIAL_RECONNECT_DELAY = 1000;
const MAX_RECONNECT_DELAY = 30000;

const BADGE_COLORS: Record<EventType | 'default', string> = {
  INSERT: "bg-green-100 text-green-800",
  UPDATE: "bg-blue-100 text-blue-800",
  DELETE: "bg-red-100 text-red-800",
  system: "bg-gray-100 text-gray-800",
  default: "bg-gray-100 text-gray-800",
};

export function RealtimeTester({ project, collection }: RealtimeTesterProps) {
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const channelName = `${project.id}:${collection.slug}`;

  // Memoize WS URL
  const wsUrl = useMemo(() => {
    // @ts-ignore
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const wsBase = apiUrl.replace("http", "ws").replace("/api", "");
    return `${wsBase}/ws`;
  }, []);

  // Auto-scroll dengan requestAnimationFrame untuk better performance
  // useEffect(() => {
  //   if (logs.length > 0 && logsEndRef.current) {
  //     requestAnimationFrame(() => {
  //       logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  //     });
  //   }
  // }, [logs.length]); // Only trigger on length change, not full logs array

  // Cleanup
  useEffect(() => {
    mountedRef.current = true;
    
    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const addLog = useCallback((type: EventType, payload: unknown) => {
    if (!mountedRef.current) return;
    
    const formattedPayload = JSON.stringify(payload, null, 2);
    
    setLogs((prev) =>
      [
        ...prev,
        {
          id: crypto.randomUUID(), // Better than Math.random()
          type,
          payload,
          formattedPayload,
          timestamp: new Date().toLocaleTimeString(),
        },
      ].slice(-MAX_LOGS)
    );
  }, []);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      addLog("system", { 
        message: `Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached. Please reconnect manually.` 
      });
      return;
    }

    const delay = Math.min(
      INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttempts),
      MAX_RECONNECT_DELAY
    );

    addLog("system", { 
      message: `Reconnecting in ${delay / 1000}s... (Attempt ${reconnectAttempts + 1}/${MAX_RECONNECT_ATTEMPTS})` 
    });

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempts(prev => prev + 1);
      connect();
    }, delay);
  }, [reconnectAttempts, addLog]);

  const subscribe = useCallback((socket: WebSocket | null = wsRef.current) => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn('Cannot subscribe: WebSocket not ready');
      return false;
    }

    try {
      socket.send(JSON.stringify({
        type: "subscribe",
        channel: channelName,
      }));
      return true;
    } catch (error) {
      console.error('Subscribe failed:', error);
      addLog("system", { message: `Subscribe failed: ${error}` });
      return false;
    }
  }, [channelName, addLog]);

  const connect = useCallback(() => {
    // Clear any pending reconnect
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    // Close existing connection
    if (wsRef.current) {
      wsRef.current.close();
    }

    try {
      setConnectionState('connecting');
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close();
          return;
        }

        setConnectionState('connected');
        setReconnectAttempts(0); // Reset on successful connection
        addLog("system", { message: "Connected to WebSocket server" });

        // Auto subscribe
        subscribe(ws);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "system") {
            addLog("system", {
              message: `System: ${data.event} - ${data.channel}`,
            });
            if (data.event === "subscribed") setIsSubscribed(true);
            if (data.event === "unsubscribed") setIsSubscribed(false);
          } else {
            // Data event
            addLog(data.event as EventType, data.payload);
          }
        } catch (error) {
          console.error("Failed to parse WS message:", error);
          addLog("system", { message: `Parse error: ${error}` });
        }
      };

      ws.onclose = (event) => {
        if (!mountedRef.current) return;

        setConnectionState('disconnected');
        setIsSubscribed(false);
        wsRef.current = null;

        const reason = event.reason || 'Unknown reason';
        addLog("system", { 
          message: `Disconnected: ${reason} (Code: ${event.code})` 
        });

        // Auto-reconnect jika bukan intentional disconnect
        if (!event.wasClean && reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
          attemptReconnect();
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        addLog("system", { message: "Connection error occurred" });
      };

      wsRef.current = ws;
    } catch (error) {
      console.error("Connection failed:", error);
      setConnectionState('disconnected');
      addLog("system", { message: `Connection failed: ${error}` });
    }
  }, [wsUrl, addLog, subscribe, attemptReconnect, reconnectAttempts]);

  const disconnect = useCallback(() => {
    // Clear reconnect attempts
    setReconnectAttempts(0);
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected'); // Clean close
    }
  }, []);

  const clearLogs = useCallback(() => setLogs([]), []);

  const getBadgeColor = useCallback((type: EventType): string => {
    return BADGE_COLORS[type] || BADGE_COLORS.default;
  }, []);

  const isConnected = connectionState === 'connected';
  const isConnecting = connectionState === 'connecting';

  return (
    <Card className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-500" />
          <h3 className="font-semibold text-gray-900">Realtime Inspector</h3>
        </div>
        <div className="flex items-center gap-2">
          <div
            className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full ${
              isConnected
                ? "bg-green-100 text-green-700"
                : isConnecting
                ? "bg-yellow-100 text-yellow-700"
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected 
                  ? "bg-green-500 animate-pulse" 
                  : isConnecting
                  ? "bg-yellow-500 animate-pulse"
                  : "bg-gray-400"
              }`}
            />
            {isConnecting
              ? "Connecting..."
              : isConnected
              ? isSubscribed
                ? "Listening"
                : "Connected"
              : "Disconnected"}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {!isConnected && !isConnecting ? (
          <Button
            onClick={connect}
            size="sm"
            className="flex-1 bg-gray-900 text-white hover:bg-gray-800"
          >
            <Wifi className="w-4 h-4 mr-2" /> Connect
          </Button>
        ) : (
          <Button
            onClick={disconnect}
            size="sm"
            variant="outline"
            className="flex-1 text-red-600 border-red-200 hover:bg-red-50"
            disabled={isConnecting}
          >
            {isConnecting ? "Connecting..." : "Disconnect"}
          </Button>
        )}
        <Button
          onClick={clearLogs}
          size="sm"
          variant="outline"
          title="Clear logs"
          disabled={logs.length === 0}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      <div className="flex-1 bg-gray-900 rounded-lg p-4 overflow-y-auto min-h-[300px] max-h-[500px] font-mono text-sm">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-gray-600 space-y-2">
            <Radio className="w-8 h-8 opacity-50" />
            <p className="text-xs">Waiting for events...</p>
            <p className="text-[10px] text-gray-500">Channel: {channelName}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <div
                key={log.id}
                className="border-l-2 border-gray-700 pl-3 py-1 animate-in fade-in slide-in-from-left-2 duration-200"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-gray-500">
                    {log.timestamp}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 rounded uppercase font-bold tracking-wider ${getBadgeColor(
                      log.type
                    )}`}
                  >
                    {log.type}
                  </span>
                </div>
                <pre className="text-gray-300 text-xs overflow-x-auto whitespace-pre-wrap break-all">
                  {log.formattedPayload}
                </pre>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <p>Tip: Make changes via API or another window to see events here.</p>
        {reconnectAttempts > 0 && reconnectAttempts < MAX_RECONNECT_ATTEMPTS && (
          <p className="text-yellow-600">
            Reconnect attempt {reconnectAttempts}/{MAX_RECONNECT_ATTEMPTS}
          </p>
        )}
      </div>
    </Card>
  );
}