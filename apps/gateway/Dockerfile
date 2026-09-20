# Build from the repo root (needs the whole workspace, not just this folder):
#   docker build -f apps/gateway/Dockerfile -t gateway .

FROM node:24-alpine AS build
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci

RUN npx nx build gateway

# ---- runtime: prod deps only + compiled js, nothing else ----
FROM node:24-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/apps/gateway/dist ./apps/gateway/dist
COPY --from=build /app/libs/common/dist ./libs/common/dist
COPY --from=build /app/libs/config/dist ./libs/config/dist
COPY --from=build /app/libs/contracts/dist ./libs/contracts/dist

WORKDIR /app/apps/gateway
USER node
CMD ["node", "dist/main.js"]
