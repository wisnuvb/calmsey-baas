import React, { useEffect, useState, useRef } from "react";
import { Collection, Project } from "../types";
import { Button } from "./ui/Button";
import Card from "./ui/Card";
import { Activity, Radio, Wifi, Trash2 } from "lucide-react";

interface RealtimeTesterProps {
  project: Project;
  collection: Collection;
}

interface EventLog {
  id: string;
  type: "INSERT" | "UPDATE" | "DELETE" | "system";
  payload: any;
  timestamp: string;
}

export function RealtimeTester({ project, collection }: RealtimeTesterProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [logs, setLogs] = useState<EventLog[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const channelName = `${project.id}:${collection.slug}`;

  // Use Vite env var or default to localhost
  const getWsUrl = () => {
    // @ts-ignore
    const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3000/api";
    const wsBase = apiUrl.replace("http", "ws").replace("/api", "");
    return `${wsBase}/ws`;
  };

  useEffect(() => {
    // Auto-scroll to bottom of logs
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connect = () => {
    try {
      const url = getWsUrl();
      const ws = new WebSocket(url);

      ws.onopen = () => {
        setIsConnected(true);
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
            addLog(data.event, data.payload);
          }
        } catch (e) {
          console.error("Failed to parse WS message", e);
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        setIsSubscribed(false);
        addLog("system", { message: "Disconnected from server" });
        wsRef.current = null;
      };

      ws.onerror = (err) => {
        console.error("WebSocket error", err);
        addLog("system", { message: "Connection error" });
      };

      wsRef.current = ws;
    } catch (e) {
      console.error("Connection failed", e);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const subscribe = (socket = wsRef.current) => {
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({
          type: "subscribe",
          channel: channelName,
        })
      );
    }
  };

  const addLog = (type: any, payload: any) => {
    setLogs((prev) =>
      [
        ...prev,
        {
          id: Math.random().toString(36).substring(2),
          type,
          payload,
          timestamp: new Date().toLocaleTimeString(),
        },
      ].slice(-50)
    ); // Keep last 50 logs
  };

  const clearLogs = () => setLogs([]);

  const getBadgeColor = (type: string) => {
    switch (type) {
      case "INSERT":
        return "bg-green-100 text-green-800";
      case "UPDATE":
        return "bg-blue-100 text-blue-800";
      case "DELETE":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

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
                : "bg-gray-100 text-gray-500"
            }`}
          >
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`}
            />
            {isConnected
              ? isSubscribed
                ? "Listening"
                : "Connected"
              : "Disconnected"}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {!isConnected ? (
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
          >
            Disconnect
          </Button>
        )}
        <Button
          onClick={clearLogs}
          size="sm"
          variant="outline"
          title="Clear logs"
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
                  {JSON.stringify(log.payload, null, 2)}
                </pre>
              </div>
            ))}
            <div ref={logsEndRef} />
          </div>
        )}
      </div>

      <p className="mt-3 text-xs text-gray-500">
        Tip: Make changes via API or another window to see events here.
      </p>
    </Card>
  );
}
