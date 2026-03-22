#!/bin/bash
# 停止所有 SkillHub 服务

echo "🛑 停止 SkillHub 服务..."

# 停止前端
echo "  停止前端服务器 (Vite)..."
pkill -f "vite dev" 2>/dev/null || echo "    未运行"

# 停止 Flarum 桥接服务
echo "  停止 Flarum 桥接服务..."
pkill -f "flarum-bridge/server.js" 2>/dev/null || echo "    未运行"

# 可选：停止 Convex（如果本地运行）
# echo "  停止 Convex..."
# pkill -f "convex dev" 2>/dev/null || echo "    未运行"

echo ""
echo "✅ 所有服务已停止"
echo ""
echo "清理日志文件:"
echo "  rm /tmp/vite8080.log /tmp/flarum-bridge.log"
