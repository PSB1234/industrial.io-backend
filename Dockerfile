# -------- Stage 1: Builder --------
    FROM node:24-alpine AS builder         
    
    RUN apk add --no-cache libc6-compat
    
    ENV PNPM_HOME="/pnpm"
    ENV PATH="$PNPM_HOME:$PATH"
    RUN corepack enable
    
    WORKDIR /app
    
    COPY package.json pnpm-lock.yaml ./
    
    ENV PNPM_IGNORE_SCRIPTS=false
    RUN pnpm install --frozen-lockfile
    
    COPY . .
    RUN pnpm build
    
    
    # -------- Stage 2: Runner --------
    FROM node:24-alpine AS runner          
    
    ENV PNPM_HOME="/pnpm"
    ENV PATH="$PNPM_HOME:$PATH"
    RUN corepack enable
    
    WORKDIR /app
    ENV NODE_ENV=production
    
    RUN addgroup --system --gid 1001 nodejs \
     && adduser --system --uid 1001 backenduser
    
    COPY package.json pnpm-lock.yaml ./
    RUN pnpm install --prod --frozen-lockfile
    
    COPY --from=builder --chown=backenduser:nodejs /app/dist ./dist
    COPY --from=builder --chown=backenduser:nodejs /app/drizzle ./drizzle
    COPY --from=builder --chown=backenduser:nodejs /app/drizzle.config.ts ./
    
    RUN chown -R backenduser:nodejs /app
    USER backenduser
    
    EXPOSE 8080
    CMD ["node", "dist/index.js"]