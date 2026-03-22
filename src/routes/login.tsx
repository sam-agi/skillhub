import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useFlarumAuth } from "../lib/flarumAuth";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const { signIn } = useFlarumAuth();
  const completeFlarumSignIn = useAction(api.flarumAuthComplete.completeFlarumSignIn);
  const { signIn: convexSignIn } = useAuthActions();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    console.log("[LoginPage] 提交登录表单");
    
    try {
      // 第一步：验证 Flarum 凭据
      const { loginWithFlarum } = await import("../lib/flarumAuth");
      const result = await loginWithFlarum(username, password);
      console.log("[LoginPage] Flarum 登录结果:", result);
      
      if (!result.success || !result.user) {
        setError(result.error || "登录失败，请检查用户名和密码");
        setIsLoading(false);
        return;
      }
      
      // 第二步：创建/更新 Convex 用户（关键步骤！）
      console.log("[LoginPage] 调用 Convex completeFlarumSignIn");
      try {
        const convexResult = await completeFlarumSignIn({
          flarumId: result.user.id,
          username: result.user.username,
          email: result.user.email,
          avatarUrl: result.user.avatarUrl || null,
        });
        console.log("[LoginPage] Convex 结果:", convexResult);
        
        if (!convexResult.success) {
          setError(convexResult.error || "创建会话失败");
          setIsLoading(false);
          return;
        }
        
        // 第三步：使用 Convex Auth 的 Credentials provider 建立会话
        if (convexResult.token) {
          try {
            const signInResult = await convexSignIn("flarum-credentials", {
              token: convexResult.token,
            });
            console.log("[LoginPage] Convex Auth 会话建立结果:", signInResult);
            
            if (!signInResult.signingIn) {
              setError("会话建立失败，请重试");
              setIsLoading(false);
              return;
            }
          } catch (authErr) {
            console.error("[LoginPage] Convex Auth 会话建立失败:", authErr);
            setError(authErr instanceof Error ? `会话建立失败: ${authErr.message}` : "会话建立失败");
            setIsLoading(false);
            return;
          }
        } else {
          setError("服务器未返回有效的会话令牌");
          setIsLoading(false);
          return;
        }
      } catch (convErr) {
        console.error("[LoginPage] Convex 调用失败:", convErr);
        // 即使 Convex 失败，本地 JWT 已经保存，可以继续
      }
      
      // 登录成功，跳转
      const redirectTo = new URLSearchParams(window.location.search).get("redirect");
      window.location.href = redirectTo || "/";
      
    } catch (err) {
      console.error("[LoginPage] 登录异常:", err);
      setError(err instanceof Error ? err.message : "登录时发生错误，请检查网络连接");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="section">
      <div className="card" style={{ maxWidth: 400, margin: "0 auto" }}>
        <h1 className="section-title" style={{ marginTop: 0, textAlign: "center" }}>
          登录 SkillHub
        </h1>
        <p className="section-subtitle" style={{ textAlign: "center" }}>
          使用 BGI 论坛账号登录
        </p>

        {error ? (
          <div
            className="error"
            style={{
              padding: "12px 16px",
              marginBottom: 16,
              borderRadius: 8,
              background: "rgba(230, 92, 70, 0.1)",
              color: "#e65c46",
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label
              htmlFor="username"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              用户名或邮箱
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="username"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "1rem",
              }}
              placeholder="输入论坛用户名"
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label
              htmlFor="password"
              style={{
                display: "block",
                marginBottom: 6,
                fontSize: "0.875rem",
                fontWeight: 500,
              }}
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
              autoComplete="current-password"
              style={{
                width: "100%",
                padding: "10px 12px",
                borderRadius: 6,
                border: "1px solid var(--line)",
                background: "var(--surface)",
                color: "var(--ink)",
                fontSize: "1rem",
              }}
              placeholder="输入论坛密码"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={isLoading || !username || !password}
            style={{ width: "100%" }}
          >
            {isLoading ? (
              <>
                <span className="spinner" style={{ marginRight: 8 }} />
                登录中...
              </>
            ) : (
              "登录"
            )}
          </button>
        </form>

        <div
          style={{
            marginTop: 20,
            paddingTop: 20,
            borderTop: "1px solid var(--line)",
            textAlign: "center",
            fontSize: "0.875rem",
            color: "var(--ink-soft)",
          }}
        >
          还没有账号？{" "}
          <a
            href="https://172.16.218.40"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)" }}
          >
            去 BGI 论坛注册
          </a>
        </div>

        <div
          style={{
            marginTop: 16,
            textAlign: "center",
            fontSize: "0.75rem",
            color: "var(--ink-soft)",
          }}
        >
          <Link to="/" style={{ color: "inherit" }}>
            ← 返回首页
          </Link>
        </div>
      </div>
    </main>
  );
}
