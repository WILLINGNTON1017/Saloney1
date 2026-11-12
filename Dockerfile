FROM node:24-bookworm-slim
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@10.17.1 --activate && pnpm install --prod --frozen-lockfile
COPY public ./public
COPY server ./server
COPY database/schema.sql ./database/schema.sql
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_DRIVER=mysql DEMO_SEED=false
USER node
EXPOSE 3000
CMD ["node", "server/index.js"]
