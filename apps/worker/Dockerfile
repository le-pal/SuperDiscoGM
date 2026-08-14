# Build context = racine du monorepo (voir docker-compose.yml). Même logique que apps/web/Dockerfile.
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

FROM base AS runtime
ENV NODE_ENV=production
# Prisma a besoin du CLI openssl au runtime pour détecter correctement la variante du query
# engine à charger (sinon il devine mal et cherche un binaire qui n'existe pas — vu en pratique).
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
COPY --from=build /app /app
RUN useradd --uid 1001 --create-home appuser && chown -R appuser:appuser /app
USER appuser
CMD ["npm", "run", "start", "--workspace=apps/worker"]
