# Versión web de OpTogether (Expo para web) servida como archivos estáticos.
# Contexto de build: raíz del repositorio.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund --ignore-scripts
COPY . .
ARG EXPO_PUBLIC_API_URL
ENV EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}
RUN test -n "$EXPO_PUBLIC_API_URL" && npx expo export --platform web --output-dir /out

FROM caddy:2-alpine
COPY server/web/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /out /srv
