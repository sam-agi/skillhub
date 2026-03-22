/**
 * Flarum 认证桥接服务
 * 
 * 提供 HTTP API 供浏览器直接验证 Flarum 用户凭据
 * 然后调用 Convex 完成登录
 */

import http from 'http';
import { createConnection } from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const PORT = process.env.FLARUM_BRIDGE_PORT || 8787;
const FLARUM_DB_HOST = process.env.FLARUM_DB_HOST || 'localhost';
const FLARUM_DB_PORT = parseInt(process.env.FLARUM_DB_PORT || '3306');
const FLARUM_DB_NAME = process.env.FLARUM_DB_NAME || 'flarum';
const FLARUM_DB_USER = process.env.FLARUM_DB_USER || 'flarum';
const FLARUM_DB_PASSWORD = process.env.FLARUM_DB_PASSWORD || 'flarum_password';
const CONVEX_SITE_URL = process.env.CONVEX_SITE_URL || 'https://decisive-sheep-693.convex.site';

// CORS 允许的源
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://127.0.0.1:8080',
  'http://172.16.218.40:8080',
  'http://192.168.100.55:8080',
];

async function verifyFlarumUser(usernameOrEmail, password) {
  let connection;
  try {
    connection = await createConnection({
      host: FLARUM_DB_HOST,
      port: FLARUM_DB_PORT,
      database: FLARUM_DB_NAME,
      user: FLARUM_DB_USER,
      password: FLARUM_DB_PASSWORD,
    });

    const [rows] = await connection.execute(
      'SELECT id, username, email, password, avatar_url, is_email_confirmed FROM users WHERE username = ? OR email = ? LIMIT 1',
      [usernameOrEmail, usernameOrEmail]
    );

    if (rows.length === 0) {
      return { valid: false, error: 'User not found' };
    }

    const user = rows[0];
    const isValid = await bcrypt.compare(password, user.password);
    
    if (!isValid) {
      return { valid: false, error: 'Invalid password' };
    }

    delete user.password;
    return { valid: true, user };
  } catch (error) {
    console.error('Database error:', error);
    return { valid: false, error: 'Database error' };
  } finally {
    if (connection) await connection.end();
  }
}

const server = http.createServer(async (req, res) => {
  // CORS headers - 允许所有来源（生产环境应该限制）
  const origin = req.headers.origin;
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    res.writeHead(405);
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  // 读取请求体
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const data = JSON.parse(body);
      
      if (req.url === '/api/verify-login') {
        const { username, password } = data;

        if (!username || !password) {
          res.writeHead(400);
          res.end(JSON.stringify({ error: 'Username and password required' }));
          return;
        }

        const result = await verifyFlarumUser(username, password);
        res.writeHead(result.valid ? 200 : 401);
        res.end(JSON.stringify(result));
      } else {
        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
      }
    } catch (error) {
      console.error('Request error:', error);
      res.writeHead(400);
      res.end(JSON.stringify({ error: 'Invalid request' }));
    }
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Flarum bridge server running on http://0.0.0.0:${PORT}`);
  console.log(`CORS enabled for: ${ALLOWED_ORIGINS.join(', ')}`);
});
