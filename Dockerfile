# Stage 1: Build
FROM node:24-alpine AS builder
WORKDIR /app

RUN addgroup -S app && adduser -S app -G app
RUN chown app:app /app
USER app

COPY --chown=app:app package*.json ./
COPY --chown=app:app prisma ./prisma/

RUN npm ci --ignore-scripts

COPY --chown=app:app . .

# Generate Prisma Client
RUN npx prisma generate

# Build (transpile TypeScript files to JavaScript)
RUN npm run build

# Stage 2: Production
FROM node:24-alpine AS production
WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

# Install only production dependencies
COPY --chown=app:app package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

# Copy built app
COPY --from=builder --chown=app:app /app/dist ./dist

# Copy package files
COPY --from=builder --chown=app:app /app/package*.json ./

RUN mkdir -p /app/logs && chown app:app /app/logs

USER app

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api', (r) => r.statusCode === 200 ? process.exit(0) : process.exit(1))"

CMD ["node", "dist/src/main.js"]