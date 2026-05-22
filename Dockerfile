# -------- Stage 1: Builder --------
    FROM node:20-alpine AS builder
    
    # Fix native deps issues (esbuild, etc.)
    RUN apk add --no-cache libc6-compat
    
    # Enable pnpm
    ENV PNPM_HOME="/pnpm"
    ENV PATH="$PNPM_HOME:$PATH"
    RUN corepack enable
    
    WORKDIR /app
    
    # Copy only lock + package first (better caching)
    COPY package.json pnpm-lock.yaml ./
    
    # IMPORTANT: allow build scripts (fixes your error)
    ENV PNPM_IGNORE_SCRIPTS=false
    RUN pnpm install --frozen-lockfile
    
    # Copy rest of code
    COPY . .
    
    # Build your app
    RUN pnpm build
    
    
    # -------- Stage 2: Runner --------
    FROM node:20-alpine AS runner
    
    ENV PNPM_HOME="/pnpm"
    ENV PATH="$PNPM_HOME:$PATH"
    RUN corepack enable
    
    WORKDIR /app
    ENV NODE_ENV=production
    
    # Create non-root user
    RUN addgroup --system --gid 1001 nodejs \
     && adduser --system --uid 1001 backenduser
    
    # Install only production deps
    COPY package.json pnpm-lock.yaml ./
    RUN pnpm install --prod --frozen-lockfile
    
    # Copy built output
    COPY --from=builder --chown=backenduser:nodejs /app/dist ./dist
    
    # If using drizzle migrations
    COPY --from=builder --chown=backenduser:nodejs /app/drizzle ./drizzle
    COPY --from=builder --chown=backenduser:nodejs /app/drizzle.config.ts ./
    
    # Set ownership
    RUN chown -R backenduser:nodejs /app
    
    USER backenduser
    
    EXPOSE 8080
    
    CMD ["node", "dist/index.js"]