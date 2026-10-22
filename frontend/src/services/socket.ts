import { io, Socket } from "socket.io-client";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:5000";

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket"],
});

let currentToken: string | null = null;

export function connectSocket(token: string) {
  if (!token) return;

  if (currentToken !== token) {
    if (socket.connected) {
      socket.disconnect();
    }
    currentToken = token;
    socket.auth = {
      token,
    };
    socket.connect();
    return;
  }

  if (!socket.connected) {
    socket.auth = {
      token,
    };
    socket.connect();
  }
}

export function disconnectSocket() {
  currentToken = null;
  socket.disconnect();
}
