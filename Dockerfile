# =========================================================
# Kogane Production Multi-Stage Dockerfile
# =========================================================

# Stage 1: Dependency installation & production build
FROM oven/bun:1-alpine AS builder

WORKDIR /app

# Install build dependencies
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

# Copy application source code
COPY . .

# Build Nuxt production bundle
ENV NODE_ENV=production
RUN bun run build

# Stage 2: Minimal production runtime
FROM oven/bun:1-alpine AS runner

WORKDIR /app

# Set production environment variables
ENV NODE_ENV=production \
    PORT=3000 \
    HOST=0.0.0.0

# Copy only the compiled output from the builder stage
COPY --from=builder /app/.output ./.output
COPY --from=builder /app/package.json ./package.json

# Optional SQLite data directory for local/single-node deployments
RUN mkdir -p /app/data && chown -R bun:bun /app

USER bun

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/ || exit 1

CMD ["bun", "run", ".output/server/index.mjs"]
