FROM oven/bun:1.2-alpine AS base 
ENV NODE_ENV=production
ENV ASTRO_TELEMETRY_DISABLED=true
WORKDIR /usr/src/app
COPY package.json bun.lock ./
COPY /packages/backend/package.json ./packages/backend/package.json
COPY /packages/frontend/package.json ./packages/frontend/package.json

# This file is for the prisma client generation
COPY /packages/backend/prisma ./packages/backend/prisma
RUN bun install --production

# ----------------- Build -----------------
FROM base AS build
COPY ./packages ./packages
RUN bun run build --filter '*' build

# ----------------- Release -----------------
FROM oven/bun:1.2-alpine AS release
WORKDIR /usr/src/app

# Install docker-cli to be able to run docker commands 
RUN apk add --no-cache docker-cli
# Script for backup the database
COPY ./packages/backend/backup.sh /usr/src/app/packages/backend/backup.sh
# Script for Seed the database
COPY ./packages/backend/prisma/seed.ts /usr/src/app/packages/backend/seed.ts

COPY --from=base /usr/src/app/node_modules ./node_modules
COPY --from=build /usr/src/app/packages/frontend/dist ./packages/frontend/dist
COPY --from=build /usr/src/app/packages/backend/dist ./packages/backend/dist
ENV NODE_ENV=production
EXPOSE 3000
WORKDIR /usr/src/app/packages/backend
CMD ["bun", "./dist/index.js"]