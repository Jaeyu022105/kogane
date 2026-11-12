# =========================================================
# Kogane Production Multi-Stage Dockerfile
# Compatible with Render, Koyeb, Fly.io, and Docker hosts
# Supports Firebase Spark (DB_PROVIDER=firebase + STORAGE_PROVIDER=firestore)
# as well as standalone SQLite (DEV_MODE=true).
# =========================================================

# Stage 1: Dependency installation & Nuxt Nitro production build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application source code
COPY . .

# Build Nuxt Nitro Node server bundle (.output/server/index.mjs)
ENV NODE_ENV=production \
    NITRO_PRESET=node-server
RUN bun run build

# Stage 2: Minimal production runtime
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Set production environment defaults (override via PaaS / container env vars)
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Copy only the compiled Nitro output from the builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Optional SQLite data directory for local/single-node deployments
RUN mkdir -p /app/data && chown -R bun:bun /app

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD sh -c "wget --no-verbose --tries=1 --spider http://127.0.0.1:${PORT:-3000}/ || exit 1"

CMD ["bun", "run", ".output/server/index.mjs"]
