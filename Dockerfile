# syntax=docker/dockerfile:1

FROM node:24-bookworm-slim AS base
# Pinned to the packageManager version in package.json.
RUN npm install -g pnpm@11.6.0
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
# Placeholder: src/db/client.ts requires DATABASE_URL at build time. The build makes no connection.
ENV DATABASE_URL=postgres://build:build@127.0.0.1:5432/build
RUN pnpm build

# Full node_modules is kept so drizzle-kit (a dev dependency) can run migrations.
FROM base AS runner
ENV NODE_ENV=production APP_HOST=0.0.0.0
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/.next ./.next
COPY --from=build /app/package.json /app/next.config.ts /app/drizzle.config.ts ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/src ./src
COPY --from=build /app/scripts ./scripts
RUN chown node:node /app
USER node
EXPOSE 3000
ENTRYPOINT ["sh", "scripts/docker-entrypoint.sh"]
