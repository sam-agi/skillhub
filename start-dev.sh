#!/bin/bash
# ClawHub 开发服务器启动脚本
# 监听所有网卡，自动寻找空闲端口

cd "$(dirname "$0")"

PORT=${1:-8080}
HOST=${2:-0.0.0.0}

echo "🚀 启动 ClawHub 开发服务器..."
echo "   主机: $HOST"
echo "   端口: $PORT"
echo ""

npx vite dev --port $PORT --host $HOST --strictPort false 2>&1 | tee /tmp/vite-dev.log
