#!/bin/bash
# 停止 ClawHub 开发服务器

echo "🛑 停止开发服务器..."
pkill -f "vite dev" 2>/dev/null && echo "   ✓ 已停止 vite" || echo "   ℹ vite 未运行"
echo "   ✓ 完成"
