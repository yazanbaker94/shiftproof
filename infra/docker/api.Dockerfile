FROM node:22.23.2-bookworm-slim AS build

WORKDIR /workspace

COPY packages/contracts/package.json packages/contracts/package-lock.json packages/contracts/tsconfig.json packages/contracts/tsconfig.build.json ./packages/contracts/
COPY packages/contracts/src ./packages/contracts/src
RUN npm ci --prefix packages/contracts \
  && npm run --prefix packages/contracts build

COPY apps/api/package.json apps/api/package-lock.json ./apps/api/
RUN npm ci --prefix apps/api

COPY apps/api/tsconfig.json apps/api/tsconfig.build.json ./apps/api/
COPY apps/api/src ./apps/api/src
COPY apps/api/scripts ./apps/api/scripts
COPY apps/api/migrations ./apps/api/migrations

RUN npm run --prefix apps/api build \
  && npm prune --prefix apps/api --omit=dev

FROM node:22.23.2-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /workspace/apps/api

COPY --from=build --chown=node:node /workspace/apps/api/package.json ./package.json
COPY --from=build --chown=node:node /workspace/apps/api/package-lock.json ./package-lock.json
COPY --from=build --chown=node:node /workspace/apps/api/node_modules ./node_modules
COPY --from=build --chown=node:node /workspace/apps/api/dist ./dist
COPY --from=build --chown=node:node /workspace/apps/api/migrations ./dist/migrations
COPY --from=build --chown=node:node /workspace/packages/contracts /workspace/packages/contracts

USER node
EXPOSE 4100

HEALTHCHECK --interval=10s --timeout=5s --start-period=20s --retries=12 \
  CMD node -e "fetch('http://127.0.0.1:4100/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "node dist/scripts/migrate.js && exec node dist/src/server.js"]
