#!/bin/bash
# SkillHub + Flarum 认证启动脚本
# BGI 内部使用

set -e

echo "🚀 启动 SkillHub (BGI 内部版 - Flarum 认证)"
echo ""

# 检查 .env.local 是否存在
if [ ! -f .env.local ]; then
    echo "❌ 未找到 .env.local 文件，请从 .env.local.example 创建"
    exit 1
fi

# 加载环境变量
export $(grep -v '^#' .env.local | xargs)

# 1. 启动 Flarum 验证桥接服务
echo "1️⃣ 启动 Flarum 认证服务..."
if ! ss -tlnp 2>/dev/null | grep -q ':8787'; then
    cd server/flarum-bridge
    if [ ! -d node_modules ]; then
        echo "   📦 安装桥接服务依赖..."
        npm install
    fi
    nohup node server.js > /tmp/flarum-bridge.log 2>&1 &
    sleep 2
    if ss -tlnp 2>/dev/null | grep -q ':8787'; then
        echo "   ✅ Flarum 桥接服务已启动 (http://127.0.0.1:8787)"
    else
        echo "   ❌ Flarum 桥接服务启动失败，查看日志: /tmp/flarum-bridge.log"
        exit 1
    fi
    cd ../..
else
    echo "   ℹ️  Flarum 桥接服务已在运行"
fi

# 2. 测试 Flarum 连接
echo ""
echo "2️⃣ 测试 Flarum 数据库连接..."
if curl -s -X POST http://127.0.0.1:8787/api/verify-login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"test"}' 2>/dev/null | grep -q "Invalid password"; then
    echo "   ✅ Flarum 验证服务正常工作"
else
    echo "   ⚠️  Flarum 验证服务可能有问题，请检查日志"
fi

# 3. 启动前端开发服务器
echo ""
echo "3️⃣ 启动前端开发服务器..."
cd "$(dirname "$0")"

# 检查 node_modules
if [ ! -d node_modules ]; then
    echo "   📦 安装前端依赖..."
    npm install
fi

nohup npx vite dev --port 8080 --host 0.0.0.0 --strictPort false > /tmp/vite8080.log 2>&1 &
sleep 4

if ss -tlnp 2>/dev/null | grep -q ':8080'; then
    echo "   ✅ 前端服务器已启动"
    echo ""
    echo "╔════════════════════════════════════════════════════════╗"
    echo "║  🎉 SkillHub (BGI Flarum 版) 启动成功！               ║"
    echo "╠════════════════════════════════════════════════════════╣"
    echo "║                                                        ║"
    echo "║  📍 访问地址:                                          ║"
    echo "║     本地: http://localhost:8080/                       ║"
    echo "║     网络: http://172.16.218.40:8080/                   ║"
    echo "║                                                        ║"
    echo "║  🔐 登录方式:                                          ║"
    echo "║     使用 BGI 论坛账号登录                              ║"
    echo "║     登录页面: http://172.16.218.40:8080/login          ║"
    echo "║                                                        ║"
    echo "║  📊 管理命令:                                          ║"
    echo "║     停止服务: ./stop-all.sh                            ║"
    echo "║     查看日志: tail -f /tmp/vite8080.log                ║"
    echo "║               tail -f /tmp/flarum-bridge.log           ║"
    echo "║                                                        ║"
    echo "╚════════════════════════════════════════════════════════╝"
else
    echo "   ❌ 前端服务器启动失败，查看日志: /tmp/vite8080.log"
    exit 1
fi
