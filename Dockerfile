FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production
ENV WWK_PORT=8789
ENV WWK_HOST=0.0.0.0

COPY package.json ./
COPY src ./src
COPY scripts/serve-operational-authority.mjs ./scripts/serve-operational-authority.mjs

RUN chown -R node:node /app
USER node

EXPOSE 8789
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD node -e "const http=require('node:http');const req=http.get('http://127.0.0.1:8789/health',res=>process.exit(res.statusCode===200?0:1));req.on('error',()=>process.exit(1));"

CMD ["node", "scripts/serve-operational-authority.mjs"]
