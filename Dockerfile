FROM node:22.14.0-alpine

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
COPY tsconfig.json ./

# Install production dependencies
RUN npm ci --only=production

# Copy source files
COPY src/ ./src/

# Install development dependencies for building
RUN npm ci

# Build TypeScript code
RUN npm run build

# Remove source and development dependencies to keep the image slim
RUN rm -rf src/ node_modules/ && \
    npm ci --only=production

# Set environment variables
ENV NODE_ENV=production

# Expose the API port
EXPOSE 3000

# Start the service
CMD ["node", "dist/index.js"] 