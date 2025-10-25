FROM node:20-bookworm-slim

# Environment
ENV NODE_ENV=production \
    # Prevent any puppeteer downloads if someday added
    PUPPETEER_SKIP_DOWNLOAD=1

WORKDIR /app

# Install dependencies first for better layer caching
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the rest of the app
COPY . .

# Ensure storage folders exist (mounted as volumes at runtime)
RUN mkdir -p /app/storage/auth /app/storage/data

# Persist WhatsApp session + reminders DB outside the container
VOLUME ["/app/storage/auth", "/app/storage/data"]

# No ports to expose (outbound only)
CMD ["node", "src/index.js"]

