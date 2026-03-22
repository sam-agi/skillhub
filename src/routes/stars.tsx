import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import type { Doc } from "../../convex/_generated/dataModel";
import { formatCompactStat } from "../lib/numberFormat";
import type { PublicSkill } from "../lib/publicUser";

export const Route = createFileRoute("/stars")({
  component: Stars,
});

function Stars() {
  const me = useQuery(api.users.me) as Doc<"users"> | null | undefined;
  const skills =
    (useQuery(api.stars.listByUser, me ? { userId: me._id, limit: 50 } : "skip") as
      | PublicSkill[]
      | undefined) ?? [];

  const toggleStar = useMutation(api.stars.toggle);

  if (!me) {
    return (
      <main className="section">
        <div className="card">登录以查看您的收藏。</div>
      </main>
    );
  }

  return (
    <main className="section">
      <h1 className="section-title">我的收藏</h1>
      <p className="section-subtitle">Skills you’ve starred for quick access.</p>
      <div className="grid">
        {skills.length === 0 ? (
          <div className="card">暂无收藏。</div>
        ) : (
          skills.map((skill) => {
            const owner = encodeURIComponent(String(skill.ownerUserId));
            return (
              <div key={skill._id} className="card skill-card">
                <Link to="/$owner/$slug" params={{ owner, slug: skill.slug }}>
                  <h3 className="skill-card-title">{skill.displayName}</h3>
                </Link>
                <div className="skill-card-footer skill-card-footer-inline">
                  <span className="stat">⭐ {formatCompactStat(skill.stats.stars)}</span>
                  <button
                    className="star-toggle is-active"
                    type="button"
                    onClick={async () => {
                      try {
                        await toggleStar({ skillId: skill._id });
                      } catch (error) {
                        console.error("取消 star 失败：", error);
                        window.alert("无法取消 star 此 skill，请重试。");
                      }
                    }}
                    aria-label={`取消 star ${skill.displayName}`}
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </main>
  );
}
