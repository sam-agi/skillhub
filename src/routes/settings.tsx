import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { gravatarUrl } from "../lib/gravatar";
import { getCurrentUser, isAuthenticated, logout, type FlarumUser } from "../lib/flarumAuth";
import { ThemeSwitcher } from "../components/ThemeSwitcher";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

function Settings() {
  const convexMe = useQuery(api.users.me);
  const updateProfile = useMutation(api.users.updateProfile);
  const deleteAccount = useMutation(api.users.deleteAccount);
  const tokens = useQuery(api.tokens.listMine) as
    | Array<{
        _id: Id<"apiTokens">;
        label: string;
        prefix: string;
        createdAt: number;
        lastUsedAt?: number;
        revokedAt?: number;
      }>
    | undefined;
  const createToken = useMutation(api.tokens.create);
  const revokeToken = useMutation(api.tokens.revoke);
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [tokenLabel, setTokenLabel] = useState("CLI token");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [flarumUser, setFlarumUser] = useState<FlarumUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // 检查 Flarum 登录状态
    if (isAuthenticated()) {
      getCurrentUser().then((user) => {
        setFlarumUser(user);
        setIsLoading(false);
      });
    } else {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!convexMe) return;
    setDisplayName(convexMe.displayName ?? "");
    setBio(convexMe.bio ?? "");
  }, [convexMe]);

  // 优先使用 Convex 用户，如果没有则使用 Flarum 用户
  const me = convexMe || (flarumUser ? {
    _id: `flarum_${flarumUser.id}` as Id<"users">,
    handle: flarumUser.username,
    name: flarumUser.username,
    displayName: flarumUser.username,
    email: flarumUser.email,
    image: flarumUser.avatarUrl,
    bio: "",
  } : null);

  const isFlarumOnly = !convexMe && flarumUser;

  if (isLoading) {
    return (
      <main className="section">
        <div className="card">加载中…</div>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="section">
        <div className="card">
          请先<Link to="/login">登录</Link>访问设置页面。
        </div>
      </main>
    );
  }

  const avatar = me.image ?? (me.email ? gravatarUrl(me.email, 160) : undefined);
  const identityName = me.displayName ?? me.name ?? me.handle ?? "Profile";
  const handle = me.handle ?? (me.email ? me.email.split("@")[0] : undefined);

  async function onSave(event: React.FormEvent) {
    event.preventDefault();
    await updateProfile({ displayName, bio });
    setStatus("已保存。");
  }

  async function onDelete() {
    const ok = window.confirm(
      "永久删除您的账号？此操作无法撤销。\n\n" +
        "已发布的 skills 将保持公开。"
    );
    if (!ok) return;
    await deleteAccount();
  }

  async function onCreateToken() {
    const label = tokenLabel.trim() || "CLI token";
    const result = await createToken({ label });
    setNewToken(result.token);
  }

  return (
    <main className="section settings-shell">
      <h1 className="section-title">设置</h1>
      <div className="card settings-profile">
        <div className="settings-avatar">
          {avatar ? (
            <img src={avatar} alt={identityName} />
          ) : (
            <span>{identityName[0]?.toUpperCase() ?? "U"}</span>
          )}
        </div>
        <div className="settings-profile-body">
          <div className="settings-name">{identityName}</div>
          {handle ? <div className="settings-handle">@{handle}</div> : null}
          {me.email ? <div className="settings-email">{me.email}</div> : null}
        </div>
      </div>
      {/* 主题设置 */}
      <div className="card settings-card">
        <h2 className="section-title" style={{ marginTop: 0, fontSize: "1.1rem" }}>
          外观设置
        </h2>
        <ThemeSwitcher />
      </div>

      {isFlarumOnly ? (
        <div className="card" style={{ background: "var(--surface-soft)", marginBottom: 20 }}>
          <p style={{ margin: 0 }}>
            ℹ️ 您使用的是论坛账号登录。部分功能（如修改资料、API Token）
            需要<Link to="/login">使用 GitHub 登录</Link>或绑定 Convex 账号。
          </p>
        </div>
      ) : (
        <form className="card settings-card" onSubmit={onSave}>
          <label className="settings-field">
            <span>显示名称</span>
            <input
              className="settings-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
            />
          </label>
          <label className="settings-field">
            <span>个人简介</span>
            <textarea
              className="settings-input"
              rows={5}
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              placeholder="告诉大家您正在构建什么。"
            />
          </label>
          <div className="settings-actions">
            <button className="btn btn-primary settings-save" type="submit">
              Save
            </button>
            {status ? <div className="stat">{status}</div> : null}
          </div>
        </form>
      )}

      {!isFlarumOnly && (
        <div className="card settings-card">
          <h2 className="section-title danger-title" style={{ marginTop: 0 }}>
            API tokens
          </h2>
          <p className="section-subtitle">
            使用这些 tokens 用于 `clawhub` CLI。Tokens 在创建时只显示一次。
          </p>

          <div className="settings-field">
            <span>Label</span>
            <input
              className="settings-input"
              value={tokenLabel}
              onChange={(event) => setTokenLabel(event.target.value)}
              placeholder="CLI token"
            />
          </div>
          <div className="settings-actions">
            <button
              className="btn btn-primary settings-save"
              type="button"
              onClick={() => void onCreateToken()}
            >
              创建 token
            </button>
            {newToken ? (
              <div className="stat" style={{ overflowX: "auto" }}>
                <div style={{ marginBottom: 8 }}>立即复制此 token：</div>
                <code>{newToken}</code>
              </div>
            ) : null}
          </div>

          {(tokens ?? []).length ? (
            <div style={{ display: "grid", gap: 10, marginTop: 16 }}>
              {(tokens ?? []).map((token) => (
                <div
                  key={token._id}
                  className="stat"
                  style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
                >
                  <div>
                    <div>
                      <strong>{token.label}</strong>{" "}
                      <span style={{ opacity: 0.7 }}>({token.prefix}…)</span>
                    </div>
                    <div style={{ opacity: 0.7 }}>
                      创建于 {formatDate(token.createdAt)}
                      {token.lastUsedAt ? ` · Used ${formatDate(token.lastUsedAt)}` : ""}
                      {token.revokedAt ? ` · 已撤销 ${formatDate(token.revokedAt)}` : ""}
                    </div>
                  </div>
                  <div>
                    <button
                      className="btn"
                      type="button"
                      disabled={Boolean(token.revokedAt)}
                      onClick={() => void revokeToken({ tokenId: token._id })}
                    >
                      {token.revokedAt ? "撤销d" : "Revoke"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="section-subtitle" style={{ marginTop: 16 }}>
              暂无 tokens。
            </p>
          )}
        </div>
      )}

      {!isFlarumOnly && (
        <div className="card danger-card">
          <h2 className="section-title danger-title">危险区域</h2>
          <p className="section-subtitle">
            永久删除您的账号。此操作无法撤销。已发布的 skills 仍保持公开。
          </p>
          <button className="btn btn-danger" type="button" onClick={() => void onDelete()}>
            删除账号
          </button>
        </div>
      )}
    </main>
  );
}

function formatDate(value: number) {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}
