FROM node:22-alpine AS base
WORKDIR /app

FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 4000

FROM base AS build
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run prisma:generate && npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache su-exec && addgroup -S app && adduser -S app -G app
COPY package*.json ./
RUN npm install --omit=dev
COPY --from=build --chown=app:app /app/dist ./dist
COPY --from=build --chown=app:app /app/assets ./assets
COPY --from=build --chown=app:app /app/docker ./docker
COPY --from=build --chown=app:app /app/prisma ./prisma
COPY --from=build --chown=app:app /app/node_modules/.prisma ./node_modules/.prisma
RUN mkdir -p /app/storage/uploads && chown -R app:app /app
EXPOSE 4000
CMD ["sh", "/app/docker/prod-entrypoint.sh"]
