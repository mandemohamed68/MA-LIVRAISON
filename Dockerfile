# Use Node.js for the build stage
FROM node:20-alpine AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application
COPY . .

# Build the Vite application
RUN npm run build

# Start the Node.js server
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
