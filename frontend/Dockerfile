# Built from the repository root (see docker-compose.yml: context ".") so it installs from the
# workspace's single package-lock.json — per-package lockfiles drift in an npm-workspaces monorepo.

# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app

# npm ci validates the lockfile against every workspace manifest, so all of them are needed;
# --workspace frontend then installs only the frontend's dependency tree.
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/.npmrc frontend/
COPY api/package.json api/
RUN npm ci --workspace frontend --include-workspace-root=false --no-audit --no-fund

COPY frontend/ frontend/

ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace frontend

# Stage 2: Runner
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser  --system --uid 1001 nextjs

# Dependencies are hoisted to /app/node_modules; Node resolves them from /app/frontend upwards.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/frontend/package.json ./frontend/
COPY --from=builder /app/frontend/.next ./frontend/.next
COPY --from=builder /app/frontend/public ./frontend/public

USER nextjs
WORKDIR /app/frontend

EXPOSE 7777
ENV PORT=7777

CMD ["npm", "start"]
