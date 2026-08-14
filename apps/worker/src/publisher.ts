import IORedis from "ioredis";

// Connexion dédiée à la publication pub/sub (séparée de la connexion BullMQ des Workers,
// qui utilise des commandes bloquantes — on ne veut pas les mélanger sur le même client).
const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
const publisher = new IORedis(redisUrl);

export interface NotificationEvent {
  userId: string;
  type: string;
  data?: Record<string, unknown>;
}

export async function publishNotification(event: NotificationEvent): Promise<void> {
  await publisher.publish("notifications", JSON.stringify(event));
}
