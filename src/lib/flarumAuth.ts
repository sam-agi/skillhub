/**
 * Flarum 统一认证集成
 * 
 * 实现与 Flarum 论坛共用登录系统的现代最佳实践：
 * 1. OAuth 2.0 授权码流程
 * 2. JWT 无状态令牌
 * 3. 自动用户同步
 */

import { useState, useEffect, useCallback } from "react";

const FLARUM_BRIDGE_URL = import.meta.env.VITE_FLARUM_BRIDGE_URL || "http://localhost:8787";
const JWT_SECRET = import.meta.env.VITE_FLARUM_JWT_SECRET; // 生产环境必须设置

export interface FlarumUser {
  id: number;
  username: string;
  email: string;
  avatarUrl?: string;
  isEmailConfirmed: boolean;
  groups?: string[];
}

export interface AuthResult {
  success: boolean;
  user?: FlarumUser;
  token?: string;
  error?: string;
}

/**
 * 使用用户名/密码登录（直接验证）
 * 适用于 SkillHub 自己的登录表单
 */
export async function loginWithFlarum(
  usernameOrEmail: string,
  password: string
): Promise<AuthResult> {
  try {
    console.log("[loginWithFlarum] 开始登录请求:", { username: usernameOrEmail, url: `${FLARUM_BRIDGE_URL}/api/auth/login` });
    
    const response = await fetch(`${FLARUM_BRIDGE_URL}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameOrEmail, password }),
    });

    console.log("[loginWithFlarum] 响应状态:", response.status);

    const data = await response.json();
    console.log("[loginWithFlarum] 响应数据:", data);

    if (!response.ok) {
      return { success: false, error: data.error || "登录失败" };
    }
    
    // 保存 JWT 令牌
    if (data.token) {
      localStorage.setItem("flarum_jwt", data.token);
    }

    return {
      success: true,
      user: data.user,
      token: data.token,
    };
  } catch (error) {
    console.error("[loginWithFlarum] 错误:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络错误，请检查桥接服务是否运行",
    };
  }
}

/**
 * OAuth 2.0 授权码流程 - 第一步：获取授权 URL
 * 适用于跳转到 Flarum 登录后回调
 */
export function getFlarumOAuthUrl(redirectUri: string, state?: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: "skillhub",
    redirect_uri: redirectUri,
    scope: "read write",
    ...(state && { state }),
  });
  
  return `${FLARUM_BRIDGE_URL}/oauth/authorize?${params.toString()}`;
}

/**
 * OAuth 2.0 授权码流程 - 第二步：用 code 换取 token
 */
export async function exchangeOAuthCode(
  code: string,
  redirectUri: string
): Promise<AuthResult> {
  try {
    const response = await fetch(`${FLARUM_BRIDGE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
        client_id: "skillhub",
      }),
    });

    if (!response.ok) {
      return { success: false, error: "授权码交换失败" };
    }

    const data = await response.json();
    
    if (data.access_token) {
      localStorage.setItem("flarum_jwt", data.access_token);
      
      // 获取用户信息
      const userInfo = await getCurrentUser(data.access_token);
      return {
        success: true,
        user: userInfo,
        token: data.access_token,
      };
    }

    return { success: false, error: "无效的响应" };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "网络错误",
    };
  }
}

/**
 * 获取当前登录用户信息
 */
export async function getCurrentUser(token?: string): Promise<FlarumUser | null> {
  const jwt = token || localStorage.getItem("flarum_jwt");
  if (!jwt) return null;

  try {
    const response = await fetch(`${FLARUM_BRIDGE_URL}/api/user/me`, {
      headers: {
        Authorization: `Bearer ${jwt}`,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        localStorage.removeItem("flarum_jwt");
      }
      return null;
    }

    return await response.json();
  } catch {
    return null;
  }
}

/**
 * 登出
 */
export async function logout(): Promise<void> {
  const jwt = localStorage.getItem("flarum_jwt");
  
  // 通知服务器使 token 失效（可选）
  if (jwt) {
    try {
      await fetch(`${FLARUM_BRIDGE_URL}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${jwt}` },
      });
    } catch {
      // 忽略错误
    }
  }
  
  localStorage.removeItem("flarum_jwt");
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(): boolean {
  return !!localStorage.getItem("flarum_jwt");
}

/**
 * 获取 JWT 令牌（用于 API 调用）
 */
export function getAuthToken(): string | null {
  return localStorage.getItem("flarum_jwt");
}

/**
 * 初始化：检查现有会话
 */
export async function initAuth(): Promise<FlarumUser | null> {
  return getCurrentUser();
}

// ============================================
// React Hooks
// ============================================

/**
 * React Hook: 使用 Flarum 认证
 * 提供完整的登录状态管理
 */
export function useFlarumAuth() {
  const [user, setUser] = useState<FlarumUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 初始化检查登录状态
  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setUser(user);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  /**
   * 登录函数
   */
  const signIn = useCallback(async (
    usernameOrEmail: string,
    password: string
  ): Promise<AuthResult> => {
    setIsLoading(true);
    setError(null);

    console.log("[useFlarumAuth.signIn] 开始登录");
    const result = await loginWithFlarum(usernameOrEmail, password);
    console.log("[useFlarumAuth.signIn] 登录结果:", result);

    if (result.success && result.user) {
      setUser(result.user);
      
      // 调用 Convex 完成 Flarum 登录，创建 Convex 会话
      try {
        console.log("[useFlarumAuth.signIn] 调用 Convex completeFlarumSignIn");
        const { api } = await import("../../convex/_generated/api");
        const { useAction } = await import("convex/react");
        
        // 使用 fetch 直接调用 Convex action
        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        const convexResponse = await fetch(`${convexUrl}/api/action`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            path: "flarumAuthComplete/completeFlarumSignIn",
            args: {
              flarumId: result.user.id,
              username: result.user.username,
              email: result.user.email,
              avatarUrl: result.user.avatarUrl || null,
            },
          }),
        });
        
        if (convexResponse.ok) {
          const convexResult = await convexResponse.json();
          console.log("[useFlarumAuth.signIn] Convex 结果:", convexResult);
          
          if (convexResult.success) {
            // 保存 Convex 会话令牌（如果有）
            if (convexResult.token) {
              localStorage.setItem("convex_token", convexResult.token);
            }
          }
        }
      } catch (e) {
        console.error("[useFlarumAuth.signIn] Convex 调用失败:", e);
        // 继续，不影响本地登录
      }
      
      setIsLoading(false);
      // 延迟跳转，让用户看到成功状态
      setTimeout(() => {
        const redirectTo = new URLSearchParams(window.location.search).get("redirect");
        window.location.href = redirectTo || "/";
      }, 500);
    } else {
      setError(result.error || "登录失败");
      setIsLoading(false);
    }

    return result;
  }, []);

  /**
   * 登出函数
   */
  const signOut = useCallback(async (): Promise<void> => {
    await logout();
    setUser(null);
    window.location.reload();
  }, []);

  return {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    signIn,
    signOut,
  };
}

/**
 * React Hook: 仅获取当前用户信息
 */
export function useFlarumUser() {
  const [user, setUser] = useState<FlarumUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        setUser(user);
        setIsLoading(false);
      })
      .catch(() => {
        setIsLoading(false);
      });
  }, []);

  return { user, isLoading, isAuthenticated: !!user };
}
