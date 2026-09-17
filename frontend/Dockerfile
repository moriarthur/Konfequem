# Frontend Dockerfile for React + Vite
# Usage: This file is used by docker-compose.yml
# For local development without Docker, see .env.local.example
FROM node:20

WORKDIR /app

# CI parity: Node 20 + npm ci (lockfile-installed, reproducible)
COPY package*.json ./
RUN npm ci && chmod +x node_modules/.bin/vite

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
