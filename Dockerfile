FROM node:22-alpine

WORKDIR /app

# 安装时区/证书基础组件(nginx 或其他静态检测由 Dockerfile 取代)
RUN apk add --no-cache ca-certificates tzdata

# 复制依赖清单并安装
COPY package.json ./
RUN npm install --production --no-audit --no-fund

# 复制应用代码
COPY index.js index.html ./

# 订阅 HTTP 服务默认端口(平台注入 PORT 时以平台值为准)
EXPOSE 3000

# 以 npm start(node index.js) 启动
CMD ["npm", "start"]