# Build from the repo root (needs the whole workspace, not just this folder):
#   docker build -f apps/notification-service/Dockerfile -t notification-service .

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci

# prisma generate only needs a syntactically valid url, not a live database
ENV NOTIFY_DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=notify"
RUN npm run prisma:generate -w apps/notification-service

RUN npx nx build notification-service

# ---- runtime: prod deps only + compiled js, nothing else ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/apps/notification-service/dist ./apps/notification-service/dist
COPY --from=build /app/libs/common/dist ./libs/common/dist
COPY --from=build /app/libs/config/dist ./libs/config/dist
COPY --from=build /app/libs/contracts/dist ./libs/contracts/dist

WORKDIR /app/apps/notification-service
USER node
CMD ["node", "dist/main.js"]
