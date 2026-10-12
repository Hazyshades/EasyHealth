FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends poppler-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN corepack enable && corepack install --global pnpm@9.15.4

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY worker/package.json worker/pnpm-lock.yaml worker/
RUN pnpm --dir worker install --frozen-lockfile
RUN pnpm prune --prod

COPY . .

WORKDIR /app/worker

CMD ["pnpm", "start"]
