FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN npm ci --workspace=apps/api --ignore-scripts

COPY apps/api ./apps/api
COPY db ./db

RUN npm run build --workspace=apps/api

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
