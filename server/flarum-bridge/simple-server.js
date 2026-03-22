/**
 * 简化版 Flarum 认证桥接服务
 */

import http from 'http';
import { createConnection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const PORT = process.env.FLARUM_BRIDGE_PORT || 8787;
const JWT_SECRET = process.env.JWT_SECRET || 'skillhub-secret-key';

// CORS 配置
const ALLOWED_ORIGINS = [
  'http://localhost:3000',
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://172.16.218.40:8080',
  'http://192.168.100.55:8080',
];

// 数据库配置
const DB_CONFIG = {
  host: process.env.FLARUM_DB_HOST || 'localhost',
  port: parseInt(process.env.FLARUM_DB_PORT || '3306'),
  database: process.env.FLARUM_DB_NAME || 'flarum',
  user: process.env.FLARUM_DB_USER || 'flarum',
  password: process.env.FLARUM_DB_PASSWORD || 'flarum_password',
};

// 验证用户
async function verifyUser(usernameOrEmail, password) {
  let connection;
  try {
    connection = await createConnection(DB_CONFIG);
    const [rows] = await connection.execute(
      'SELECT id, username, email, password, avatar_url, is_email_confirmed FROM users WHERE username = ? OR email = ? LIMIT 1',
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
function generateToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, email: user.email, avatar: user.avatarUrl },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

// 验证 JWT
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// 设置 CORS
function setCors(res, origin) {
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// 发送 JSON
function json(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// 解析请求体
async function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } catch { resolve({}); }
    });
  });
}

// 创建服务器
const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  setCors(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  
  console.log(`[${new Date().toISOString()}] ${req.method} ${url.pathname}`);

  // 登录端点
  if (url.pathname === '/api/auth/login' && req.method === 'POST') {
    const body = await parseBody(req);
    const { username, password } = body;

    if (!username || !password) {
      return json(res, 400, { error: '缺少用户名或密码' });
    }

    const result = await verifyUser(username, password);
    
    if (!result.valid) {
      return json(res, 401, { error: result.error });
    }

    const token = generateToken(result.user);
    console.log(`[AUTH] User ${result.user.username} logged in`);
    
    return json(res, 200, {
      success: true,
      token,
      user: result.user,
    });
  }

  // 获取用户信息
  if (url.pathname === '/api/user/me' && req.method === 'GET') {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
      return json(res, 401, { error: '缺少认证令牌' });
    }

    const payload = verifyToken(authHeader.slice(7));
    if (!payload) {
      return json(res, 401, { error: '无效或过期的令牌' });
    }

    return json(res, 200, {
      id: payload.sub,
      username: payload.username,
      email: payload.email,
      avatarUrl: payload.avatar,
    });
  }

  // 登出
  if (url.pathname === '/api/auth/logout' && req.method === 'POST') {
    return json(res, 200, { success: true });
  }

  // 健康检查
  if (url.pathname === '/health' && req.method === 'GET') {
    return json(res, 200, { status: 'ok' });
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`🚀 Flarum Auth Bridge 运行在 http://localhost:${PORT}`);
});
