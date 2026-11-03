FROM node:24.15.0-alpine3.22 AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --workspace=@landmarknav/api --include-workspace-root=false
COPY apps/api/ apps/api/
RUN npm run build --workspace=@landmarknav/api

FROM node:24.15.0-alpine3.22 AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/mobile/package.json apps/mobile/package.json
RUN npm ci --omit=dev --workspace=@landmarknav/api --include-workspace-root=false \
    && npm cache clean --force
COPY --from=build --chown=node:node /app/apps/api/dist/ apps/api/dist/
COPY --from=build --chown=node:node /app/apps/api/migrations/ apps/api/migrations/
WORKDIR /app/apps/api
USER node
EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "dist/server.js"]
