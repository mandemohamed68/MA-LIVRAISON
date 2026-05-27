# Stage 1: Build
FROM node:20-alpine AS build
# Install build tools necessary for compiling native modules like better-sqlite3
RUN apk add --no-cache python3 make g++

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
# Prune node_modules to keep only production dependencies
RUN npm prune --production

# Stage 2: Production
FROM node:20-alpine
WORKDIR /app
# Copy the compiled server and static client files
COPY --from=build /app/dist ./dist
# Copy prebuilt and compiled native/production modules
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./

# Expose port and start server
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
