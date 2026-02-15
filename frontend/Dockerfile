# Frontend Dockerfile for React + Vite
# Usage: This file is used by docker-compose.yml
# For local development without Docker, see .env.local.example
FROM node:18

WORKDIR /app

COPY package*.json ./
RUN npm install && chmod +x node_modules/.bin/vite

COPY . .

EXPOSE 5173
CMD ["npm", "run", "dev"]
