# -----------------------------------------------------------------------------
# Stage 1: Build stage (compile TypeScript & generate Prisma client)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root workspace manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
COPY prisma/schema.prisma ./prisma/schema.prisma

# Install all dependencies (including devDependencies required for build)
RUN npm ci

# Copy configuration and source files
COPY tsconfig.base.json ./
COPY packages/shared ./packages/shared/
COPY apps/api ./apps/api/

# Generate Prisma Client and compile packages to JavaScript
RUN npx prisma generate --schema prisma/schema.prisma
RUN npm run build -w packages/shared
RUN npm run build -w apps/api

# -----------------------------------------------------------------------------
# Stage 2: Production runtime stage (strictly minimal, no tests, docs, or seeds)
# -----------------------------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4000

# Copy workspace package manifests
COPY package*.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY apps/api/package*.json ./apps/api/
COPY prisma/schema.prisma ./prisma/schema.prisma
COPY prisma/migrations ./prisma/migrations/

# Install ONLY production dependencies
RUN npm ci --omit=dev && npm cache clean --force

# Copy only the compiled dist artifacts from the builder stage
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copy generated Prisma engine & client and CLI from builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder /app/node_modules/.bin/prisma ./node_modules/.bin/prisma

# Copy startup entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Switch to standard non-root user
USER node

EXPOSE 4000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "apps/api/dist/server.js"]
