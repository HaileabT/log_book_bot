FROM node:20-alpine


RUN corepack enable pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile


COPY . .

CMD ["pnpm", "run", "dev"]