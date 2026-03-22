import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Clock, Package, Plus, Upload } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatCompactStat } from "../lib/numberFormat";
import type { PublicSkill } from "../lib/publicUser";
import type { Id } from "../../convex/_generated/dataModel";
import { getCurrentUser, isAuthenticated, type FlarumUser } from "../lib/flarumAuth";

type DashboardSkill = PublicSkill & { pendingReview?: boolean };

export const Route = createFileRoute("/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const convexMe = useQuery(api.users.me) as Doc<"users"> | null | undefined;
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

  // 优先使用 Convex 用户，如果没有则使用 Flarum 用户
  const me = convexMe || (flarumUser ? {
    _id: `flarum_${flarumUser.id}` as Id<"users">,
    handle: flarumUser.username,
    name: flarumUser.username,
    displayName: flarumUser.username,
    email: flarumUser.email,
    image: flarumUser.avatarUrl,
  } : null);

  const mySkills = useQuery(
    api.skills.list,
    convexMe?._id ? { ownerUserId: convexMe._id, limit: 100 } : "skip",
  ) as DashboardSkill[] | undefined;

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
          请先<Link to="/login">登录</Link>访问您的 dashboard。
        </div>
      </main>
    );
  }

  const skills = mySkills ?? [];
  const ownerHandle = me.handle ?? me.name ?? me.displayName ?? me._id;

  return (
    <main className="section">
      <div className="dashboard-header">
        <h1 className="section-title" style={{ margin: 0 }}>
          我的 Skills
        </h1>
        <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden="true" />
          上传新 Skill
        </Link>
      </div>

      {skills.length === 0 ? (
        <div className="card dashboard-empty">
          <Package className="dashboard-empty-icon" aria-hidden="true" />
          <h2>还没有 Skills</h2>
          <p>上传您的第一个 Skill 与社区分享。</p>
          <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
            <Upload className="h-4 w-4" aria-hidden="true" />
            上传 Skill
          </Link>
        </div>
      ) : (
        <div className="dashboard-grid">
          {skills.map((skill) => (
            <SkillCard key={skill._id} skill={skill} ownerHandle={ownerHandle} />
          ))}
        </div>
      )}
    </main>
  );
}

function SkillCard({ skill, ownerHandle }: { skill: DashboardSkill; ownerHandle: string | null }) {
  return (
    <div className="dashboard-skill-card">
      <div className="dashboard-skill-info">
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <Link
            to="/$owner/$slug"
            params={{ owner: ownerHandle ?? "unknown", slug: skill.slug }}
            className="dashboard-skill-name"
          >
            {skill.displayName}
          </Link>
          <span className="dashboard-skill-slug">/{skill.slug}</span>
          {skill.pendingReview ? (
            <span className="tag tag-pending">
              <Clock className="h-3 w-3" aria-hidden="true" />
              扫描中
            </span>
          ) : null}
        </div>
        {skill.summary && <p className="dashboard-skill-description">{skill.summary}</p>}
        <div className="dashboard-skill-stats">
          <span>
            <Package size={13} aria-hidden="true" /> {formatCompactStat(skill.stats.downloads)}
          </span>
          <span>★ {formatCompactStat(skill.stats.stars)}</span>
          <span>{skill.stats.versions} v</span>
        </div>
      </div>
      <div className="dashboard-skill-actions">
        <Link to="/upload" search={{ updateSlug: skill.slug }} className="btn btn-sm">
          <Upload className="h-3 w-3" aria-hidden="true" />
          新版本
        </Link>
        <Link
          to="/$owner/$slug"
          params={{ owner: ownerHandle ?? "unknown", slug: skill.slug }}
          className="btn btn-ghost btn-sm"
        >
          查看
        </Link>
      </div>
    </div>
  );
}
