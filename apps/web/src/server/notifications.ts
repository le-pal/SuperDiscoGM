import IORedis from "ioredis";
import type { Server as SocketIOServer } from "socket.io";

// S'abonne au canal pub/sub Redis alimenté par apps/worker (publisher.ts) et relaie vers la
// room Socket.IO user:<id> correspondante — le worker n'a pas de connexion Socket.IO directe.
interface NotificationEvent {
  userId: string;
  type: string;
  data?: Record<string, unknown>;
}

export function subscribeToNotifications(io: SocketIOServer): void {
  const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
  // Un client en mode subscribe ne peut plus servir à autre chose — connexion dédiée.
  const subscriber = new IORedis(redisUrl);

  subscriber.subscribe("notifications").catch((err) => {
    console.error("Échec de l'abonnement au canal notifications:", err);
  });

  subscriber.on("message", (_channel, message) => {
    try {
      const event = JSON.parse(message) as NotificationEvent;
      io.to(`user:${event.userId}`).emit("notification", event);
    } catch (err) {
      console.error("Notification pub/sub illisible:", err);
    }
  });
}
