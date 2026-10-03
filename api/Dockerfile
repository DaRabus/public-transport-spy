# Built from the repository root (see docker-compose.yml: context ".") so it installs from the
# workspace's single package-lock.json, like the frontend image.
FROM node:24-bookworm-slim AS base
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates tini curl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

FROM base AS deps
# npm ci validates the lockfile against every workspace manifest, so all of them are needed.
COPY package.json package-lock.json ./
COPY api/package.json api/
COPY frontend/package.json frontend/.npmrc frontend/
RUN npm ci --workspace api --include-workspace-root=false --no-audit --no-fund

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
WORKDIR /app/api
COPY api/tsconfig.json api/tsconfig.build.json api/nest-cli.json api/package.json ./
COPY api/src ./src
RUN npx --no-install nest build

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
WORKDIR /app/api
COPY --from=build /app/api/dist ./dist
COPY api/package.json ./
EXPOSE 7778
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/main.js"]
