FROM node:22-alpine AS base
WORKDIR /app

FROM base AS development
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 3000

FROM base AS build
COPY package*.json ./
RUN npm install
COPY . .
ARG NEXT_PUBLIC_API_URL
ARG NEXT_SERVER_API_URL
ARG NEXT_PUBLIC_SHOW_DEV_TOOLS=false
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_SERVER_API_URL=$NEXT_SERVER_API_URL
ENV NEXT_PUBLIC_SHOW_DEV_TOOLS=$NEXT_PUBLIC_SHOW_DEV_TOOLS
RUN npm run build

FROM node:22-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/.next/static ./app/.next/static
COPY --from=build /app/.next/static ./frontend/.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/public ./app/public
COPY --from=build /app/public ./frontend/public
EXPOSE 3000
CMD ["sh", "-c", "SERVER=$(find /app -maxdepth 4 -name server.js | head -n 1); if [ -z \"$SERVER\" ]; then echo 'server.js not found in standalone output' >&2; find /app -maxdepth 4 -type f >&2; exit 1; fi; echo \"Starting $SERVER\"; node \"$SERVER\";"]
