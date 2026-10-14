# Use official Node.js 20 image
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package.json and lock files
COPY package.json .
COPY package-lock.json . || true

# Install dependencies (including dev for building)
RUN npm ci

# Copy source code
COPY . .

# Build TypeScript
RUN npm run build

# ---- Production image ----
FROM node:20-alpine

WORKDIR /app

# Copy only built files and production deps
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./ || true
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Install only production dependencies
RUN npm ci --only=production

# Expose port (default in server.ts)
EXPOSE 4000

# Start the server
CMD ["node", "dist/server.js"]
