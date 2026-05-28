# Lokus inference proxy — Bun runtime image.
# Listens on :3000 (docker bridge). Caddy (separate service) fronts 443/80.
FROM oven/bun:1.1-slim AS base
WORKDIR /app

# Install deps first for layer caching. Bun 1.3 writes a text `bun.lock`
# (the older binary `bun.lockb` is also matched if present).
FROM base AS deps
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile || bun install

# Final image.
FROM base AS runtime
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Run as the unprivileged user the bun image ships with.
USER bun
EXPOSE 3000

# Primary: Bun (native WebSocket relay + Bun.serve). The Node 22 fallback would
# be `node --experimental-strip-types src/index.ts`; Bun is the supported path.
CMD ["bun", "run", "src/index.ts"]
