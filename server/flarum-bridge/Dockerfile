FROM node:20-alpine

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci --only=production

# 复制代码
COPY enhanced-server.js ./server.js

# 非 root 用户运行
USER node

EXPOSE 8787

CMD ["node", "server.js"]
