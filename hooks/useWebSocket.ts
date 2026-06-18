import { useState, useEffect, useCallback, useRef } from 'react';
import { getToken } from '@/utils/api';

export type WSMessage = {
  type: string;
  data: any;
};

const buildWebSocketUrl = (apiUrl: string, token: string) => {
  try {
    const url = new URL(apiUrl);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    url.pathname = `${url.pathname.replace(/\/$/, "")}/ws/chat`;
    url.searchParams.set("token", token);
    return url.toString();
  } catch {
    return `${apiUrl.replace(/^http/, "ws").replace(/\/$/, "")}/ws/chat?token=${encodeURIComponent(token)}`;
  }
};

export const useWebSocket = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [messages, setMessages] = useState<WSMessage[]>([]);
  const ws = useRef<WebSocket | null>(null);

  const connect = useCallback(async () => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    try {
      const token = await getToken();
      if (!token) return;

      const apiUrl = process.env.EXPO_PUBLIC_API_URL || "http://localhost:8080/api/v1";
      const wsUrl = buildWebSocketUrl(apiUrl, token);

      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        setIsConnected(true);
        console.log("WebSocket connected");
      };

      ws.current.onmessage = (event) => {
        const lines = String(event.data).split("\n").map((line) => line.trim()).filter(Boolean);
        const nextMessages: WSMessage[] = [];

        for (const line of lines) {
          try {
            nextMessages.push(JSON.parse(line));
          } catch (err) {
            console.error("Failed to parse WS message", err);
          }
        }

        if (nextMessages.length) {
          setMessages(prev => [...prev, ...nextMessages]);
        }
      };

      ws.current.onclose = () => {
        setIsConnected(false);
        console.log("WebSocket disconnected");
      };

      ws.current.onerror = (error) => {
        console.error("WebSocket error", {
          readyState: ws.current?.readyState,
          url: wsUrl.replace(/token=[^&]+/, "token=<hidden>"),
          type: (error as any)?.type || "error",
        });
      };
    } catch (err) {
      console.error("WebSocket connection failed", err);
    }
  }, []);

  const disconnect = useCallback(() => {
    if (ws.current) {
      ws.current.close();
      ws.current = null;
    }
  }, []);

  useEffect(() => {
    connect();
    return () => disconnect();
  }, [connect, disconnect]);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  return { isConnected, messages, clearMessages, connect, disconnect };
};
