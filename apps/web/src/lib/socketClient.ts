import { io, type Socket } from "socket.io-client";

// Le cookie de session est envoyé automatiquement au handshake (même origine) — voir
// server/socket.ts, io.use() qui vérifie ce cookie en DB. withCredentials explicite pour
// rester correct même si web est un jour servi depuis un sous-domaine différent derrière Caddy.
let socket: Socket | undefined;

export function getSocket(): Socket {
  if (!socket) {
    socket = io({ path: "/socket.io", withCredentials: true });
  }
  return socket;
}
