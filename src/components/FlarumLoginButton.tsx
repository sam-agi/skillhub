/**
 * Flarum 统一登录按钮
 * 
 * 提供与 Flarum 论坛共用的登录功能
 */

import { useState, useEffect } from "react";
import { 
  loginWithFlarum, 
  getCurrentUser, 
  logout, 
  isAuthenticated,
  type FlarumUser 
} from "../lib/flarumAuth";

interface FlarumLoginButtonProps {
  onLogin?: (user: FlarumUser) => void;
  onLogout?: () => void;
}

export function FlarumLoginButton({ onLogin, onLogout }: FlarumLoginButtonProps) {
  const [user, setUser] = useState<FlarumUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  // 初始化检查登录状态
  useEffect(() => {
    if (isAuthenticated()) {
      getCurrentUser().then(setUser);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    const result = await loginWithFlarum(username, password);
    
    if (result.success && result.user) {
      setUser(result.user);
      onLogin?.(result.user);
      setShowForm(false);
      setUsername("");
      setPassword("");
    } else {
      setError(result.error || "登录失败");
    }
    
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    onLogout?.();
  };

  // 已登录状态
  if (user) {
    return (
      <div className="flarum-user-menu">
        <img 
          src={user.avatarUrl || "/default-avatar.png"} 
          alt={user.username}
          className="avatar"
        />
        <span className="username">{user.username}</span>
        <button onClick={handleLogout} className="btn btn-secondary">
          退出
        </button>
      </div>
    );
  }

  // 未登录状态
  return (
    <div className="flarum-login">
      {!showForm ? (
        <button 
          onClick={() => setShowForm(true)} 
          className="btn btn-primary"
        >
          登录 / 注册
        </button>
      ) : (
        <form onSubmit={handleLogin} className="login-form">
          <input
            type="text"
            placeholder="用户名或邮箱"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            disabled={loading}
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
          />
          {error && <div className="error">{error}</div>}
          <div className="form-actions">
            <button type="submit" disabled={loading} className="btn btn-primary">
              {loading ? "登录中..." : "登录"}
            </button>
            <button 
              type="button" 
              onClick={() => setShowForm(false)}
              className="btn btn-secondary"
            >
              取消
            </button>
          </div>
          <div className="form-links">
            <a href="https://forum.yourdomain.com/forgot" target="_blank" rel="noopener">
              忘记密码？
            </a>
            <a href="https://forum.yourdomain.com/signup" target="_blank" rel="noopener">
              去论坛注册
            </a>
          </div>
        </form>
      )}
    </div>
  );
}
