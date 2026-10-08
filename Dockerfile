FROM node:22-bookworm-slim AS build
WORKDIR /app
# Compile SQLite against the headers already included in the Node image.
ENV npm_config_nodedir=/usr/local
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
RUN corepack enable
COPY package.json yarn.lock .yarnrc.yml ./
COPY client/package.json client/package.json
COPY server/package.json server/package.json
COPY shared/package.json shared/package.json
RUN yarn install --immutable --inline-builds
COPY tsconfig.base.json ./
COPY client client
COPY server server
COPY shared shared
RUN yarn build
RUN yarn workspaces focus presight-server --production

FROM node:22-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3001 \
    DATABASE_PATH=/app/data/directory.sqlite \
    CLIENT_DIST_PATH=/app/client/dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/shared/package.json ./shared/package.json
COPY --from=build /app/shared/index.js ./shared/index.js
COPY --from=build /app/server/package.json ./server/package.json
COPY --from=build /app/server/dist ./server/dist
COPY --from=build /app/client/dist ./client/dist
COPY docker/entrypoint.sh ./docker/entrypoint.sh
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3001
HEALTHCHECK --interval=10s --timeout=5s --start-period=10s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/health').then(r => { if (!r.ok) process.exit(1) }).catch(() => process.exit(1))"
ENTRYPOINT ["sh", "/app/docker/entrypoint.sh"]
CMD ["node", "server/dist/index.js"]
