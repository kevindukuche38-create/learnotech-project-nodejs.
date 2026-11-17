FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/app/data
COPY package.json server.js ./
COPY public ./public
RUN mkdir -p /app/data/uploads && chown -R node:node /app
USER node
EXPOSE 8080
VOLUME ["/app/data"]
CMD ["npm", "start"]
