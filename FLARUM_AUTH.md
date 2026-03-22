# Flarum 论坛集成认证 (完整版)

## 概述

SkillHub 现在完全支持使用 **BGI Flarum 论坛**的用户账号登录，替代原有的 GitHub OAuth 认证。

## 系统架构

```
┌─────────────┐      ┌──────────────────┐      ┌─────────────┐
│   前端      │ ──── │  Convex 后端     │ ──── │ Flarum MySQL │
│  React      │      │  Action/Mutation │      │   数据库     │
└─────────────┘      └──────────────────┘      └─────────────┘
                            │
                            ▼
                     ┌──────────────┐
                     │ 验证桥接服务  │
                     │  :8787       │
                     └──────────────┘
```

## 文件结构

### 后端 (Convex)

| 文件 | 说明 |
|------|------|
| `convex/schema.ts` | 添加 `flarumId`, `flarumUsername`, `flarumSyncedAt`, `authProvider` 字段 |
| `convex/flarumAuthComplete.ts` | 完整的 Flarum 认证实现（登录/用户管理） |
| `convex/auth.ts` | 保留 GitHub OAuth（可选备用） |

### 桥接服务

| 文件 | 说明 |
|------|------|
| `server/flarum-bridge/server.js` | Node.js + MySQL + bcrypt 验证服务 |
| `server/flarum-bridge/package.json` | 依赖配置 |

### 前端

| 文件 | 说明 |
|------|------|
| `src/routes/login.tsx` | BGI 论坛登录页面 |
| `src/components/Header.tsx` | 使用 Flarum 认证的 Header |
| `src/lib/flarumAuth.ts` | Flarum 认证 React Hooks |

## 功能特性

- ✅ **用户验证**: 使用 bcrypt 验证 Flarum 密码
- ✅ **自动注册**: 首次登录自动创建 SkillHub 账号
- ✅ **账号关联**: 支持邮箱关联已有账号
- ✅ **登出功能**: 完整的登出支持
- ⚠️ **会话管理**: 需要 Convex 重新生成类型后才能完全正常工作

## 快速开始

### 1. 安装依赖

```bash
# 安装桥接服务依赖
cd server/flarum-bridge
npm install

# 返回根目录
cd ../..
```

### 2. 配置环境变量

编辑 `.env.local`:

```bash
# Frontend
VITE_CONVEX_URL=https://decisive-sheep-693.convex.cloud
VITE_CONVEX_SITE_URL=https://decisive-sheep-693.convex.site
SITE_URL=http://localhost:8080

# Flarum 论坛认证配置
FLARUM_DB_HOST=localhost
FLARUM_DB_PORT=3306
FLARUM_DB_NAME=flarum
FLARUM_DB_USER=flarum
FLARUM_DB_PASSWORD=flarum_password
FLARUM_VERIFY_URL=http://127.0.0.1:8787/api/verify-login

# Convex 部署配置
CONVEX_DEPLOYMENT=dev:decisive-sheep-693
```

### 3. 启动服务

#### 方法一：一键启动

```bash
./start-with-flarum.sh
```

#### 方法二：手动启动（三个终端）

**终端 1 - Flarum 桥接服务:**
```bash
cd server/flarum-bridge
node server.js
```

**终端 2 - Convex:**
```bash
npx convex dev
```

**终端 3 - 前端:**
```bash
npx vite dev --port 8080 --host 0.0.0.0
```

### 4. 访问

- **首页**: http://172.16.218.40:8080/
- **登录**: http://172.16.218.40:8080/login

## 用户数据映射

| Flarum 论坛 | SkillHub 字段 | 说明 |
|-------------|---------------|------|
| `id` | `flarumId` | 论坛用户ID |
| `username` | `name`, `handle`, `displayName` | 用户名 |
| `email` | `email` | 邮箱 |
| `avatar_url` | `image` | 头像URL |
| - | `authProvider` | 固定值 "flarum" |
| - | `flarumSyncedAt` | 同步时间戳 |

## API 参考

### 前端 Hooks

```typescript
import { useFlarumAuth } from "../lib/flarumAuth";

function MyComponent() {
  const { 
    user,              // 当前用户信息
    isAuthenticated,   // 是否已登录
    isLoading,         // 是否加载中
    isFlarumUser,      // 是否通过 Flarum 登录
    signIn,            // 登录函数
    signOut,           // 登出函数
    syncProfile        // 同步用户信息
  } = useFlarumAuth();

  // 登录
  const handleLogin = async () => {
    const result = await signIn("username", "password");
    if (!result.success) {
      console.error(result.error);
    }
  };

  // 登出
  const handleLogout = async () => {
    await signOut();
  };
}
```

### Convex Actions/Mutations

```typescript
// 登录
const result = await ctx.runAction(api.flarumAuthComplete.signInWithFlarum, {
  username: "user",
  password: "pass"
});

// 获取当前用户
const user = await ctx.runQuery(api.flarumAuthComplete.getCurrentUser);

// 检查是否 Flarum 用户
const isFlarum = await ctx.runQuery(api.flarumAuthComplete.isFlarumAuthenticated);
```

## 认证流程

```
1. 用户输入用户名/密码
         ↓
2. 前端调用 signInWithFlarum Action
         ↓
3. Convex Action 请求本地 :8787 验证服务
         ↓
4. 桥接服务查询 Flarum MySQL + bcrypt 验证
         ↓
5. 验证成功 → 创建/更新 Convex 用户
         ↓
6. 返回 userId → 前端刷新页面
         ↓
7. 使用 Convex Auth 标准流程创建会话
```

## 已知限制

### 1. 会话管理
当前实现中，登录成功后返回 userId，但需要进一步集成 Convex Auth 来创建完整的会话。这可以通过以下方式解决：- 使用 Convex Auth 的自定义 Provider- 或者使用 JWT token 机制

### 2. 类型生成
由于 Convex 需要重新生成类型文件 (`convex/_generated`)，在开发过程中可能会看到 TypeScript 错误。这些错误在运行 `npx convex dev` 后应该会自动解决。

### 3. 并发修改
如果多个用户同时登录，Convex 的 OCC (乐观并发控制) 机制会自动处理冲突。

## 故障排除

### 无法连接到 Flarum 数据库

```bash
# 检查 MySQL 连接
cd /home/ztron/flarum
mysql -uflarum -pflarum_password -e "SELECT 1" flarum

# 检查桥接服务日志
cat /tmp/flarum-bridge.log
```

### 登录失败

1. 检查桥接服务是否运行: `ss -tlnp | grep 8787`
2. 检查用户名/密码是否正确
3. 检查 Flarum 用户邮箱是否已验证

### TypeScript 类型错误

```bash
# 重新生成 Convex 类型
npx convex codegen

# 或者重启 Convex 开发服务器
npx convex dev --reset
```

## 生产部署

### 部署 Convex 函数

```bash
npx convex deploy
```

### 配置生产环境变量

在 Convex Dashboard 设置:
- `FLARUM_VERIFY_URL`: 生产环境验证服务地址（建议使用 HTTPS）

### 部署验证服务

建议将桥接服务部署为内部服务：

```bash
# 使用 systemd
sudo systemctl enable flarum-bridge
sudo systemctl start flarum-bridge

# 或使用 pm2
pm2 start server/flarum-bridge/server.js --name flarum-bridge
pm2 save
pm2 startup
```

## 安全建议

1. **使用 HTTPS**: 生产环境所有通信都应使用 HTTPS
2. **限制桥接服务访问**: 桥接服务只应允许 Convex 服务器访问
3. **定期更新密码**: Flarum 数据库密码应定期更换
4. **审计日志**: 记录所有登录尝试
5. **失败限制**: 实现登录失败次数限制（防止暴力破解）

## 后续增强

- [ ] 集成 Convex Auth 自定义 Provider
- [ ] 实现完整的会话管理
- [ ] 添加登录失败次数限制
- [ ] 支持 Flarum 用户组映射到 SkillHub 角色
- [ ] 自动同步 Flarum 用户信息（定时任务）
- [ ] 双因素认证支持
- [ ] LDAP/AD 企业集成

## 许可证

与原项目相同：MIT License
Copyright (c) 2026 Peter Steinberger

修改部分同样遵循 MIT 协议。
