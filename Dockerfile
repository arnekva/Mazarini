# syntax=docker/dockerfile:1

# ---------- build stage ----------
FROM node:20-bookworm AS build
WORKDIR /app

# Native build toolchain for canvas/sharp
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential python3 pkg-config \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
 && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run bundle

# ---------- runtime stage ----------
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production

# Runtime libs for canvas/sharp + git (startup commit-log feature) + tools to fetch curl-impersonate
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 libjpeg62-turbo libgif7 librsvg2-2 \
    ca-certificates fonts-liberation curl git \
 && rm -rf /var/lib/apt/lists/* \
 && git config --system --add safe.directory /app

# Install curl-impersonate (provides the curl_chrome116 binary used for scraping).
# TARGETARCH is set automatically by Docker buildkit (arm64 on Apple Silicon / Oracle A1, amd64 on Intel).
ARG TARGETARCH
RUN set -eux; \
    case "${TARGETARCH}" in \
      arm64) CI_ARCH=aarch64 ;; \
      amd64) CI_ARCH=x86_64 ;; \
      *) echo "unsupported arch ${TARGETARCH}"; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/ci.tar.gz \
      "https://github.com/lwthiker/curl-impersonate/releases/download/v0.6.1/curl-impersonate-v0.6.1.${CI_ARCH}-linux-gnu.tar.gz"; \
    tar -xzf /tmp/ci.tar.gz -C /usr/local/bin; \
    rm /tmp/ci.tar.gz

# Bring over the built app, its node_modules, and runtime assets (res/, templates/, memes.json, ...)
COPY --from=build /app ./

CMD ["node", "bin/bundle.js"]
