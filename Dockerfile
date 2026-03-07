# Stage 1: Build
FROM node:24-alpine AS builder

# libc6-compat is typically needed for Alpine when dealing with native node modules (like those in esbuild/prisma/drizzle if any)
RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
# Use frozen-lockfile for deterministic builds
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Production
FROM node:24-alpine AS runner

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backenduser

COPY package.json pnpm-lock.yaml ./
# Install only production dependencies for deterministic output
RUN pnpm install --prod --frozen-lockfile

COPY --from=builder --chown=backenduser:nodejs /app/dist ./dist
# Drizzle files might be needed for migrations
COPY --from=builder --chown=backenduser:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=backenduser:nodejs /app/drizzle.config.ts ./

# Ensure the backenduser owns the necessary app files
RUN chown -R backenduser:nodejs /app

USER backenduser

# Note: Matching the 8080 port used in your docker-compose.yml
EXPOSE 8080

# Execute node directly instead of through pnpm for better signal handling
CMD ["node", "dist/index.js"]
