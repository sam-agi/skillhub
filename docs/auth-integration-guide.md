# SkillHub + Flarum 统一认证方案

## 概述
现有三种现代最佳实践方案，按推荐程度排序：

---

## 方案 1：Keycloak / Authentik 作为中央 IdP（最推荐）

### 架构
```
SkillHub (React) ──┐
                   ├──▶ Keycloak/Authentik ──▶ PostgreSQL
Flarum (PHP) ──────┘         │
                        LDAP/AD (可选)
```

### 优点
- **标准化**: OAuth 2.0 / OIDC 行业标准
- **功能丰富**: 2FA、SSO、社交登录、用户管理界面
- **可扩展**: 未来可轻松添加更多应用
- **安全**: 专业身份管理，定期安全更新

### 部署步骤

#### 1. 部署 Keycloak (Docker)
```yaml
# docker-compose.yml
version: '3'
services:
  keycloak:
    image: quay.io/keycloak/keycloak:24.0
    command: start-dev
    environment:
      KC_DB: postgres
      KC_DB_URL: jdbc:postgresql://postgres:5432/keycloak
      KC_DB_USERNAME: keycloak
      KC_DB_PASSWORD: keycloak_pass
      KEYCLOAK_ADMIN: admin
      KEYCLOAK_ADMIN_PASSWORD: admin_pass
      KC_HOSTNAME: auth.yourdomain.com
    ports:
      - "8081:8080"
    depends_on:
      - postgres

  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: keycloak
      POSTGRES_USER: keycloak
      POSTGRES_PASSWORD: keycloak_pass
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  postgres_data:
```

#### 2. 配置 Flarum 使用 Keycloak
```bash
# 安装 Flarum OAuth 扩展
composer require fof/oauth

# 在 Flarum 后台配置 Keycloak Provider
# Client ID: flarum
# Client Secret: [从 Keycloak 获取]
# Authorization Endpoint: http://auth.yourdomain.com/realms/master/protocol/openid-connect/auth
# Token Endpoint: http://auth.yourdomain.com/realms/master/protocol/openid-connect/token
# User Info Endpoint: http://auth.yourdomain.com/realms/master/protocol/openid-connect/userinfo
```

#### 3. 配置 SkillHub 使用 Keycloak
```typescript
// src/lib/auth/keycloak.ts
import { createClient } from '@auth/core/client';

export const keycloakConfig = {
  id: 'keycloak',
  name: 'Keycloak',
  type: 'oidc',
  issuer: 'http://auth.yourdomain.com/realms/master',
  clientId: 'skillhub',
  clientSecret: process.env.KEYCLOAK_CLIENT_SECRET,
};
```

---

## 方案 2：现有 Flarum 桥接增强（当前架构优化）

你已有 `server/flarum-bridge/` 实现，可以继续优化：

### 当前架构
```
SkillHub ──▶ Flarum Bridge ──▶ MySQL (Flarum DB)
                │
                └──▶ Convex (用户数据同步)
```

### 优化建议

#### 1. 升级为 JWT 令牌（无状态）
```javascript
// server/flarum-bridge/server.js
import jwt from 'jsonwebtoken';

// 登录成功后签发 JWT
const token = jwt.sign(
  { 
    sub: user.id,
    username: user.username,
    email: user.email,
    avatar: user.avatar_url 
  },
  process.env.JWT_SECRET,
  { expiresIn: '7d' }
);

// SkillHub 验证 JWT 而非查询数据库
```

#### 2. 使用 Redis 缓存会话
```javascript
import Redis from 'ioredis';
const redis = new Redis();

// 缓存登录状态
await redis.setex(`session:${token}`, 3600, JSON.stringify(user));
```

#### 3. 添加 OIDC 标准端点
```javascript
// /.well-known/openid-configuration
app.get('/.well-known/openid-configuration', (req, res) => {
  res.json({
    issuer: 'https://flarum.yourdomain.com',
    authorization_endpoint: 'https://flarum.yourdomain.com/oauth/authorize',
    token_endpoint: 'https://flarum.yourdomain.com/oauth/token',
    userinfo_endpoint: 'https://flarum.yourdomain.com/oauth/userinfo',
    jwks_uri: 'https://flarum.yourdomain.com/oauth/jwks',
  });
});
```

---

## 方案 3：使用 Supabase Auth / Auth0（托管服务）

如果不想自建，使用托管服务：

### Supabase Auth
```typescript
// 免费额度 generous
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Flarum 和 SkillHub 都使用 Supabase Auth
// 需要 Flarum 扩展支持
```

### Auth0
- 专业级，但收费
- 支持企业 SSO

---

## 推荐选择

| 场景 | 推荐方案 |
|------|----------|
| 有运维能力，追求长期稳定 | **Keycloak** |
| 快速实现，基于现有代码 | **优化现有桥接 + JWT** |
| 不想维护基础设施 | **Supabase Auth** |
| 企业环境 | **Keycloak + LDAP** |

---

## 实施方案（推荐：优化现有桥接）

基于你已有代码，最快的实现：

### Step 1: 启动 Flarum 桥接
```bash
cd server/flarum-bridge
npm install
node server.js
```

### Step 2: SkillHub 配置
`.env.local`:
```
VITE_FLARUM_BRIDGE_URL=http://172.16.218.40:8787
```

### Step 3: 登录流程
1. 用户在 SkillHub 点击"登录"
2. 弹出窗口访问 Flarum 登录页
3. Flarum 登录成功后回调到 SkillHub
4. SkillHub 调用桥接服务验证
5. 创建/更新 Convex 用户数据

### 安全注意事项
- 使用 HTTPS 生产环境
- JWT 签名密钥定期轮换
- 实施速率限制
- 审计日志
