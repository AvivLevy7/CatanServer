# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Catan client - React/Vite static bundle served by Nginx
#
#   docker build -t catan-client --build-arg VITE_API_URL=https://your-api.example.com .
#   docker run -p 80:80 catan-client
#
# VITE_API_URL is compiled into the bundle, so it must be supplied at BUILD time
# (build arg here, or the hosting platform's build environment). If omitted,
# the value from .env.production is used.
# ---------------------------------------------------------------------------

# ---- Build stage -----------------------------------------------------------
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

COPY . .

ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# ---- Runtime stage ---------------------------------------------------------
FROM nginx:1.27-alpine AS runtime

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
