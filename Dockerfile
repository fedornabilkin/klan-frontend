FROM node:24-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM caddy:2-alpine AS runtime
ENV KLAN_DOMAIN=:80 \
    API_UPSTREAM=host.docker.internal:3001 \
    FRONTEND_ROOT=/srv
COPY --from=build /app/dist /srv
COPY deploy/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80 443 443/udp
