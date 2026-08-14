# Build context = racine du monorepo (voir docker-compose.yml).
# Image "tout le monorepo" plutôt qu'un prune par workspace : plus simple à maintenir pour
# un déploiement perso/petit groupe (cf doc/technique/spec.md). Debian slim (pas Alpine) pour
# éviter les soucis connus OpenSSL/musl avec Prisma.
#
# Postgres est embarqué DANS cette image (choix explicite, temporaire — voir
# doc/technique/architecture.md) : un seul conteneur web+DB, worker s'y connecte par le réseau
# compose. Nécessite de rester root au runtime (Postgres doit pouvoir s'initialiser/chown son
# PGDATA) — pas d'utilisateur non-root ici, contrairement à apps/worker/Dockerfile.
FROM node:24-bookworm-slim AS base
WORKDIR /app

FROM base AS deps
# CA locale optionnelle (proxy/antivirus TLS-inspecting sur le poste de build, ex: Avast) —
# docker/local-ca/ est vide en prod (juste un .gitkeep), donc ceci est un no-op hors poste de dev concerné.
COPY docker/local-ca/ /usr/local/share/ca-certificates/local/
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NODE_OPTIONS=--use-system-ca
COPY package.json package-lock.json ./
COPY apps/web/package.json apps/web/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/jobs/package.json packages/jobs/package.json
RUN npm ci

FROM deps AS build
COPY . .
RUN npm run db:generate
RUN npm run build --workspace=apps/web

FROM base AS runtime
ENV NODE_ENV=production
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
RUN chmod +x /app/apps/web/docker-entrypoint.sh
EXPOSE 3000 5432
ENTRYPOINT ["/app/apps/web/docker-entrypoint.sh"]
