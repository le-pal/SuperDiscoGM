import IORedis from "ioredis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

// BullMQ impose maxRetriesPerRequest: null sur la connexion des Workers/QueueEvents (bloquants).
export const connection = new IORedis(redisUrl, {
  maxRetriesPerRequest: null,
});
