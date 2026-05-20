# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
# Copy the compiled server, static files, and package files
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/package-lock.json ./
# Install only production dependencies
RUN npm install --production

# Expose port and start server
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
