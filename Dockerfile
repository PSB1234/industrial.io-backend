# Stage 1: Build the app
FROM node:24-alpine AS builder

RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

# Stage 2: Install production dependencies only
FROM node:24-alpine AS prod-deps

RUN apk add --no-cache libc6-compat
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --prod --frozen-lockfile

# Stage 3: Production Runner
FROM node:24-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Create a non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 backenduser

# Copy ONLY what is needed for production, setting ownership simultaneously 
# This avoids the `chown -R` layer bloat!
COPY --from=prod-deps --chown=backenduser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=backenduser:nodejs /app/dist ./dist
COPY --from=builder --chown=backenduser:nodejs /app/drizzle ./drizzle
COPY --from=builder --chown=backenduser:nodejs /app/drizzle.config.ts ./
COPY --from=builder --chown=backenduser:nodejs /app/package.json ./

USER backenduser

# Note: Matching the 8080 port used in your docker-compose.yml
EXPOSE 8080

# Execute node directly instead of through pnpm for better signal handling
CMD ["node", "dist/index.js"]