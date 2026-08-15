// Postgres embarqué pour développement/tests locaux SANS Docker (embedded-postgres, MIT) —
// port dédié (5433) pour ne jamais entrer en conflit avec un vrai Postgres/le service Docker
// (docker-compose.yml utilise 5432). Données dans .local-pgdata/ (gitignored, jetable).
//
// Usage :
//   node scripts/local-test-db.mjs start   -> démarre le cluster, crée la base si absente, affiche DATABASE_URL
//   node scripts/local-test-db.mjs stop    -> arrête proprement
//
// Le process reste attaché tant qu'il tourne (Ctrl+C ou `stop` pour arrêter) quand lancé en
// "start" sans détachement — utile pour laisser tourner pendant une session de test.

import EmbeddedPostgres from "embedded-postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", ".local-pgdata");
const PORT = 5433;
const USER = "superdiscogm";
const PASSWORD = "devlocal";
const DB_NAME = "superdiscogm";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  port: PORT,
  user: USER,
  password: PASSWORD,
  persistent: true,
  // Force UTF-8 : sans ça, initdb dérive l'encodage de la locale Windows (ex: WIN1252 sur ce
  // poste), ce qui casse dès qu'un message contient un emoji (🎲, cf apps/web/src/server/socket.ts)
  // ou certains accents. --locale=C évite aussi la dépendance à la locale système pour le tri.
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

const command = process.argv[2] ?? "start";

if (command === "start") {
  await pg.initialise();
  await pg.start();

  const client = pg.getPgClient();
  await client.connect();
  const { rows } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [DB_NAME]);
  if (rows.length === 0) {
    await client.query(`CREATE DATABASE "${DB_NAME}"`);
    console.log(`Base "${DB_NAME}" créée.`);
  } else {
    console.log(`Base "${DB_NAME}" déjà présente.`);
  }
  await client.end();

  const url = `postgresql://${USER}:${PASSWORD}@localhost:${PORT}/${DB_NAME}?schema=public`;
  console.log(`Postgres embarqué démarré sur le port ${PORT}.`);
  console.log(`DATABASE_URL="${url}"`);

  process.on("SIGINT", async () => {
    await pg.stop();
    process.exit(0);
  });
} else if (command === "stop") {
  await pg.stop();
  console.log("Postgres embarqué arrêté.");
} else {
  console.error(`Commande inconnue : ${command} (attendu: start | stop)`);
  process.exit(1);
}
