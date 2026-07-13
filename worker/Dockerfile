FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
COPY worker/package.json worker/

RUN corepack enable && pnpm install --filter easyhealth... --filter easyhealth-document-worker... || pnpm install

COPY . .

WORKDIR /app/worker

CMD ["pnpm", "start"]
