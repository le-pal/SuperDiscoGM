// Redis en mémoire pour développement/tests locaux SANS Docker (redis-memory-server, MIT) —
// port dédié (6380) pour ne jamais entrer en conflit avec le service Docker (docker-compose.yml
// utilise 6379). Fonctionne sur Windows (vérifié) contrairement à beaucoup d'outils "Redis natif".
//
// Usage : node scripts/local-test-redis.mjs
// Reste attaché tant qu'il tourne (Ctrl+C pour arrêter) — pas de sous-commande stop séparée,
// contrairement à local-test-db.mjs, car redis-memory-server ne persiste rien entre les runs.
import { RedisMemoryServer } from "redis-memory-server";

const PORT = 6380;

const server = new RedisMemoryServer({ instance: { port: PORT } });
const host = await server.getHost();
const port = await server.getPort();

console.log(`Redis embarqué démarré sur ${host}:${port}.`);
console.log(`REDIS_URL="redis://${host}:${port}"`);

process.on("SIGINT", async () => {
  await server.stop();
  process.exit(0);
});
