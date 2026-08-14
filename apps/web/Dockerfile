# Build context = racine du monorepo (voir docker-compose.yml).
# Image "tout le monorepo" plutôt qu'un prune par workspace : plus simple à maintenir pour
# un déploiement perso/petit groupe (cf doc/technique/spec.md). Debian slim (pas Alpine) pour
# éviter les soucis connus OpenSSL/musl avec Prisma.
#
# Postgres est un service séparé (voir docker-compose.yml) — la version "Postgres embarqué
# dans web" a été abandonnée : initdb au premier démarrage rendait le boot du conteneur trop
# lent. Les migrations sont appliquées par le conteneur `migrate` dédié, pas par web lui-même.
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
# DATABASE_URL factice : `prisma generate` (Prisma 7, via prisma.config.ts) exige la variable
# résolvable mais ne se connecte pas réellement à la DB — la vraie valeur vient du runtime
# (docker-compose.yml), jamais présente ici puisque .env est exclu du contexte de build.
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build?schema=public"
RUN npm run db:generate
RUN npm run build --workspace=apps/web

FROM base AS runtime
ENV NODE_ENV=production
# Prisma a besoin du CLI openssl au runtime pour détecter correctement la variante du query
# engine à charger (même souci rencontré et corrigé sur apps/worker/Dockerfile).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
RUN useradd --uid 1001 --create-home appuser && chown -R appuser:appuser /app
USER appuser
EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=apps/web"]
