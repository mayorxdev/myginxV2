import { useEffect, useCallback } from "react";

export function useWebSocket(onMessage: (data: any) => void) {
  const connect = useCallback(() => {
    const ws = new WebSocket("ws://localhost:1337/ws");

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        onMessage(data);
      } catch (error) {
        console.error("WebSocket message parse error:", error);
      }
    };

    ws.onclose = () => {
      // Reconnect after 1 second
      setTimeout(connect, 1000);
    };

    return ws;
  }, [onMessage]);

  useEffect(() => {
    const ws = connect();
    return () => ws.close();
  }, [connect]);
}
