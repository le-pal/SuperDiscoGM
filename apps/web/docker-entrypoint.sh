#!/bin/sh
# Postgres embarqué dans l'image web (choix explicite : simplicité d'un seul conteneur, au prix
# de la séparation de cycle de vie DB/appli — voir doc/technique/architecture.md).
set -e

PGDATA=/app/pgdata
PGBIN=$(pg_config --bindir 2>/dev/null || ls -d /usr/lib/postgresql/*/bin | head -n1)

if [ ! -s "$PGDATA/PG_VERSION" ]; then
  echo "> Initialisation de PGDATA (premier démarrage)"
  mkdir -p "$PGDATA"
  chown -R postgres:postgres "$PGDATA"
  su postgres -c "$PGBIN/initdb -D $PGDATA"
  echo "listen_addresses = '*'" >> "$PGDATA/postgresql.conf"
  echo "host all all 0.0.0.0/0 md5" >> "$PGDATA/pg_hba.conf"
fi

chown -R postgres:postgres "$PGDATA"

su postgres -c "$PGBIN/pg_ctl -D $PGDATA -l $PGDATA/server.log start"

echo "> Attente de Postgres..."
until su postgres -c "$PGBIN/pg_isready -h localhost" >/dev/null 2>&1; do
  sleep 0.5
done

# Rôle/DB applicatifs — idempotent, pour survivre aux redémarrages sur volume déjà initialisé.
su postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='${POSTGRES_USER}'\" | grep -q 1 || psql -c \"CREATE ROLE \\\"${POSTGRES_USER}\\\" LOGIN PASSWORD '${POSTGRES_PASSWORD}'\""
su postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'\" | grep -q 1 || psql -c \"CREATE DATABASE \\\"${POSTGRES_DB}\\\" OWNER \\\"${POSTGRES_USER}\\\"\""

export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}?schema=public"

echo "> Migrations Prisma (équivalent Flyway : migrate deploy, jamais migrate dev en prod)"
npm run migrate:deploy --workspace=packages/db
npm run seed --workspace=packages/db

echo "> Démarrage de Next.js"
exec npm run start --workspace=apps/web
