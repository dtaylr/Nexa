FROM node:20-alpine

# wget is used by the healthcheck
RUN apk add --no-cache wget

WORKDIR /app

# Install dependencies first (layer cache)
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/
RUN apk add --no-cache python3 make g++ && \
    npm ci --workspace=apps/api

# Copy source and build
COPY apps/api ./apps/api
COPY db ./db

RUN npm run build --workspace=apps/api

EXPOSE 3001
CMD ["node", "apps/api/dist/index.js"]
