FROM node:22-alpine AS base

FROM base AS builder

RUN apk add --no-cache gcompat

RUN npm install -g pnpm@10

WORKDIR /app

COPY package*.json tsconfig.json ./
COPY src ./src
COPY .env .env

RUN pnpm install && pnpm build

FROM base AS runner
WORKDIR /app

RUN npm install -g pnpm@10

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 hono

# Create the temp and logs directories and set permissions
RUN mkdir -p /app/temp && chown hono:nodejs /app/temp
RUN mkdir -p /app/logs && chown hono:nodejs /app/logs

COPY --from=builder --chown=hono:nodejs /app/node_modules /app/node_modules
COPY --from=builder --chown=hono:nodejs /app/dist /app/dist
COPY --from=builder --chown=hono:nodejs /app/src /app/src
COPY --from=builder --chown=hono:nodejs /app/.env /app/.env
COPY --from=builder --chown=hono:nodejs /app/package.json /app/package.json
COPY --from=builder --chown=hono:nodejs /app/tsconfig.json /app/tsconfig.json


USER hono
EXPOSE 3000

CMD ["sh", "-c", "pnpm db:mgrt:up && echo 'Migration completed successfully' && pnpm db:seed:run --class=CoreSeeder && echo 'Core seeding completed succesfully' && node --env-file=/app/.env /app/dist/index.js"]
