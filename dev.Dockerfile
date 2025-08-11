FROM node:22-alpine

RUN apk add --no-cache gcompat

RUN npm install -g pnpm@10

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install

# Set proper permissions
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

# Set permissions for mounted volumes
RUN mkdir -p /app/temp && chown hono:nodejs /app/temp
RUN mkdir -p /app/logs && chown hono:nodejs /app/logs

USER hono
EXPOSE 3000

CMD ["pnpm", "dev"]
