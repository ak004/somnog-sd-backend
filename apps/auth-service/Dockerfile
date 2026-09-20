# Build from the repo root (needs the whole workspace, not just this folder):
#   docker build -f apps/auth-service/Dockerfile -t auth-service .

FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json nx.json tsconfig.base.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci

# prisma generate only needs a syntactically valid url, not a live database
ENV AUTH_DATABASE_URL="postgresql://user:pass@localhost:5432/db?schema=auth"
RUN npm run prisma:generate -w apps/auth-service

RUN npx nx build auth-service

# ---- runtime: prod deps only + compiled js, nothing else ----
FROM node:20-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps ./apps
COPY libs ./libs
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/apps/auth-service/dist ./apps/auth-service/dist
COPY --from=build /app/libs/common/dist ./libs/common/dist
COPY --from=build /app/libs/config/dist ./libs/config/dist
COPY --from=build /app/libs/contracts/dist ./libs/contracts/dist

WORKDIR /app/apps/auth-service
USER node
CMD ["node", "dist/main.js"]
