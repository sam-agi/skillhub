/**
 * 增强版 Flarum 认证桥接服务
 * 
 * 现代最佳实践：
 * 1. JWT 无状态认证
 * 2. OAuth 2.0 标准流程
 * 3. 速率限制
 * 4. 审计日志
 */

import http from 'http';
import { createConnection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { rateLimit } from 'express-rate-limit';

const PORT = process.env.FLARUM_BRIDGE_PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '7d';

// Flarum 数据库配置
const FLARUM_DB_CONFIG = {
  host: process.env.FLARUM_DB_HOST || 'localhost',
  port: parseInt(process.env.FLARUM_DB_PORT || '3306'),
  database: process.env.FLARUM_DB_NAME || 'flarum',
  user: process.env.FLARUM_DB_USER || 'flarum',
  password: process.env.FLARUM_DB_PASSWORD || 'flarum_password',
};

// CORS 配置
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://172.16.218.40:8080',
  'http://192.168.100.55:8080',
];

// 简单的内存速率限制器
const rateLimiter = new Map();
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 分钟
const RATE_LIMIT_MAX = 100; // 每个 IP 100 次请求

function checkRateLimit(ip) {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW;
  
  if (!rateLimiter.has(ip)) {
    rateLimiter.set(ip, []);
  }
  
  const requests = rateLimiter.get(ip).filter(time => time > windowStart);
  requests.push(now);
  rateLimiter.set(ip, requests);
  
  return requests.length <= RATE_LIMIT_MAX;
}

// 验证 Flarum 用户
async function verifyFlarumUser(usernameOrEmail, password) {
  let connection;
  try {
    connection = await createConnection(FLARUM_DB_CONFIG);

    const [rows] = await connection.execute(
      `SELECT u.id, u.username, u.email, u.password, 
              u.avatar_url, u.is_email_confirmed,
              GROUP_CONCAT(g.name_singular) as groups
       FROM users u
       LEFT JOIN group_user gu ON u.id = gu.user_id
       LEFT JOIN groups g ON gu.group_id = g.id
       WHERE u.username = ? OR u.email = ?
       GROUP BY u.id
       LIMIT 1`,
      [usernameOrEmail, usernameOrEmail]
    );

    if (rows.length === 0) {
      return { valid: false, error: '用户不存在' };
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return { valid: false, error: '密码错误' };
    }

    return {
      valid: true,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatar_url,
        isEmailConfirmed: !!user.is_email_confirmed,
        groups: user.groups ? user.groups.split(',') : [],
      }
    };
  } catch (error) {
    console.error('Database error:', error);
    return { valid: false, error: '服务器错误' };
  } finally {
    if (connection) await connection.end();
  }
}

// 生成 JWT
function generateJWT(user) {
  return jwt.sign(
    {
      sub: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatarUrl,
      groups: user.groups,
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

// 验证 JWT
function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// CORS 头
function setCorsHeaders(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
}

// 发送 JSON 响应
function sendJSON(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// 路由处理器
const routes = {
  // 健康检查
  'GET /health': async (req, res) => {
    sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
  },

  // 直接登录（用户名/密码）
  'POST /api/auth/login': async (req, res) => {
    const body = await parseBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return sendJSON(res, 400, { error: '缺少用户名或密码' });
    }

    const result = await verifyFlarumUser(username, password);
    
    if (!result.valid) {
      return sendJSON(res, 401, { error: result.error });
    }

    const token = generateJWT(result.user);
    
    // 审计日志
    console.log(`[AUTH] User ${result.user.username} logged in from ${req.clientIp}`);
    
    sendJSON(res, 200, {
      success: true,
      token,
      user: result.user,
    });
  },

  // 获取当前用户信息
  'GET /api/user/me': async (req, res) => {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendJSON(res, 401, { error: '缺少认证令牌' });
    }

    const token = authHeader.slice(7);
    const payload = verifyJWT(token);
    
    if (!payload) {
      return sendJSON(res, 401, { error: '无效或过期的令牌' });
    }

    sendJSON(res, 200, {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      avatarUrl: payload.avatar,
      groups: payload.groups,
    });
  },

  // 登出（使令牌失效 - 需要 Redis 或数据库黑名单）
  'POST /api/auth/logout': async (req, res) => {
    // TODO: 将令牌加入黑名单
    sendJSON(res, 200, { success: true });
  },

  // OAuth 2.0: 授权端点
  'GET /oauth/authorize': async (req, res) => {
    // 重定向到 Flarum 登录页或自定义登录页
    const { client_id, redirect_uri, state } = req.query;
    
    // TODO: 实现完整的 OAuth 授权码流程
    sendJSON(res, 501, { error: 'OAuth 流程待实现' });
  },

  // OAuth 2.0: 令牌端点
  'POST /oauth/token': async (req, res) => {
    const body = await parseBody(req);
    const { grant_type, code, username, password } = body;

    if (grant_type === 'password') {
      // 密码凭证流程（用于受信任的客户端）
      const result = await verifyFlarumUser(username, password);
      if (!result.valid) {
        return sendJSON(res, 401, { error: 'invalid_grant' });
      }

      const accessToken = generateJWT(result.user);
      
      sendJSON(res, 200, {
        access_token: accessToken,
        token_type: 'Bearer',
        expires_in: 604800, // 7天
      });
    } else {
      sendJSON(res, 400, { error: 'unsupported_grant_type' });
    }
  },

  // JWKS 端点（用于验证 JWT 签名）
  'GET /.well-known/jwks.json': async (req, res) => {
    // TODO: 返回公钥用于 JWT 验证
    sendJSON(res, 501, { error: 'JWKS 待实现' });
  },

  // OpenID Connect 发现文档
  'GET /.well-known/openid-configuration': async (req, res) => {
    const baseUrl = `http://${req.headers.host}`;
    sendJSON(res, 200, {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/oauth/authorize`,
      token_endpoint: `${baseUrl}/oauth/token`,
      userinfo_endpoint: `${baseUrl}/api/user/me`,
      jwks_uri: `${baseUrl}/.well-known/jwks.json`,
      response_types_supported: ['code', 'token'],
      grant_types_supported: ['authorization_code', 'password'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256', 'HS256'],
    });
  },
};

// 解析请求体
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// 解析 URL 和查询参数
function parseUrl(req) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  return {
    pathname: url.pathname,
    query: Object.fromEntries(url.searchParams),
  };
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  const clientIp = req.socket.remoteAddress;
  req.clientIp = clientIp;

  // 速率限制
  if (!checkRateLimit(clientIp)) {
    return sendJSON(res, 429, { error: '请求过于频繁，请稍后再试' });
  }

  // CORS
  setCorsHeaders(res, req.headers.origin);

  // 预检请求
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 解析 URL
  const { pathname, query } = parseUrl(req);
  req.query = query;

  // 查找路由
  const routeKey = `${req.method} ${pathname}`;
  const handler = routes[routeKey];

  if (handler) {
    try {
      await handler(req, res);
    } catch (error) {
      console.error('Route error:', error);
      sendJSON(res, 500, { error: '服务器内部错误' });
    }
  } else {
    sendJSON(res, 404, { error: '未找到' });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Flarum Auth Bridge 服务运行中`);
  console.log(`   端口: ${PORT}`);
  console.log(`   健康检查: http://localhost:${PORT}/health`);
  console.log(`   OIDC 配置: http://localhost:${PORT}/.well-known/openid-configuration`);
});
