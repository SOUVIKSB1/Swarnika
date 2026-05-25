# Backend Dockerfile for Node.js Express app
# Use official Node LTS image
FROM node:18-bullseye-slim

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies
COPY package.json package-lock.json* ./
RUN npm ci --only=production || npm install --production

# Copy source
COPY . .

# Expose port
EXPOSE 5001

# Default env (can be overridden by the deployment platform)
ENV NODE_ENV=production
ENV PORT=5001

# Start the server
CMD ["node", "server.js"]
