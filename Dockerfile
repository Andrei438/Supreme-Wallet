# Build stage
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (only production ones)
RUN npm install --omit=dev

# Copy application source
COPY . .

# Final stage
FROM node:20-slim

WORKDIR /app

# Copy from builder
COPY --from=builder /app /app

# Ensure data directory exists and has correct permissions
RUN mkdir -p /app/data && chown -R node:node /app

# Switch to non-root user
USER node

# Expose port
EXPOSE 3000

# Start application
CMD ["npm", "start"]
