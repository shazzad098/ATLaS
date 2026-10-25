# syntax=docker/dockerfile:1
# Build from the repository root so the API can sync the shared Prisma schema:
#   docker build -f api/Dockerfile -t atlas-api .

FROM node:22-bookworm-slim AS build
WORKDIR /app

COPY api/package.json api/package-lock.json ./api/
RUN cd api && npm ci --ignore-scripts

COPY prisma ./prisma
COPY api ./api
RUN cd api && npm run build

# ---- runtime ----------------------------------------------------------------
FROM node:22-bookworm-slim AS runner
WORKDIR /app/api
ENV NODE_ENV=production \
    API_PORT=4000

COPY --from=build /app/api/package.json /app/api/package-lock.json ./
COPY --from=build /app/api/node_modules ./node_modules
COPY --from=build /app/api/dist ./dist

USER node
EXPOSE 4000

CMD ["node", "dist/main.js"]
