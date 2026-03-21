import { createFileRoute, Link } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { api } from "../../convex/_generated/api";
import { InstallSwitcher } from "../components/InstallSwitcher";
import { SkillCard } from "../components/SkillCard";
import { SkillStatsTripletLine } from "../components/SkillStats";
import { SoulCard } from "../components/SoulCard";
import { SoulStatsTripletLine } from "../components/SoulStats";
import { UserBadge } from "../components/UserBadge";
import { convexHttp } from "../convex/client";
import { getSkillBadges } from "../lib/badges";
import type { PublicSkill, PublicSoul, PublicUser } from "../lib/publicUser";
import { getSiteMode } from "../lib/site";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  const mode = getSiteMode();
  return mode === "souls" ? <OnlyCrabsHome /> : <SkillsHome />;
}

function SkillsHome() {
  type SkillPageEntry = {
    skill: PublicSkill;
    ownerHandle?: string | null;
    owner?: PublicUser | null;
    latestVersion?: unknown;
  };

  const [highlighted, setHighlighted] = useState<SkillPageEntry[]>([]);
  const [popular, setPopular] = useState<SkillPageEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    convexHttp
      .query(api.skills.listHighlightedPublic, { limit: 6 })
      .then((r) => {
        if (!cancelled) setHighlighted(r as SkillPageEntry[]);
      })
      .catch(() => {});
    convexHttp
      .query(api.skills.listPublicPageV4, {
        numItems: 12,
        sort: "downloads",
        dir: "desc",
        nonSuspiciousOnly: true,
      })
      .then((r) => {
        if (!cancelled) setPopular((r as { page: SkillPageEntry[] }).page);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">轻量级 · 为 Agent 打造</span>
            <h1 className="hero-title">SkillHub，智能 Agent 的技能库。</h1>
            <p className="hero-subtitle">
              上传 Skills 技能包，像 npm 一样管理版本，通过向量搜索快速发现。
              无门槛，只有信号。
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
                发布 Skill
              </Link>
              <Link
                to="/skills"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  highlighted: undefined,
                  nonSuspicious: true,
                  view: undefined,
                  focus: undefined,
                }}
                className="btn"
              >
                浏览 Skills
              </Link>
            </div>
          </div>
          <div className="hero-card hero-search-card fade-up" data-delay="2">
            <div className="hero-install" style={{ marginTop: 18 }}>
              <div className="stat">搜索 Skills。版本管理，随时回滚。</div>
              <InstallSwitcher exampleSlug="sonoscli" />
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">精选 Skills</h2>
        <p className="section-subtitle">精选推荐 — 快速信任的高质量技能。</p>
        <div className="grid">
          {highlighted.length === 0 ? (
            <div className="card">暂无精选 Skills。</div>
          ) : (
            highlighted.map((entry) => (
              <SkillCard
                key={entry.skill._id}
                skill={entry.skill}
                badge={getSkillBadges(entry.skill)}
                summaryFallback="一个全新的技能包。"
                meta={
                  <div className="skill-card-footer-rows">
                    <UserBadge
                      user={entry.owner}
                      fallbackHandle={entry.ownerHandle ?? null}
                      prefix="by"
                      link={false}
                    />
                    <div className="stat">
                      <SkillStatsTripletLine stats={entry.skill.stats} />
                    </div>
                  </div>
                }
              />
            ))
          )}
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">热门 Skills</h2>
        <p className="section-subtitle">下载量最高的安全技能。</p>
        <div className="grid">
          {popular.length === 0 ? (
            <div className="card">暂无 Skills。成为第一个发布者！</div>
          ) : (
            popular.map((entry) => (
              <SkillCard
                key={entry.skill._id}
                skill={entry.skill}
                summaryFallback="Agent 可用的技能包。"
                meta={
                  <div className="skill-card-footer-rows">
                    <UserBadge
                      user={entry.owner}
                      fallbackHandle={entry.ownerHandle ?? null}
                      prefix="by"
                      link={false}
                    />
                    <div className="stat">
                      <SkillStatsTripletLine stats={entry.skill.stats} />
                    </div>
                  </div>
                }
              />
            ))
          )}
        </div>
        <div className="section-cta">
          <Link
            to="/skills"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              highlighted: undefined,
              nonSuspicious: true,
              view: undefined,
              focus: undefined,
            }}
            className="btn"
          >
            查看全部 Skills
          </Link>
        </div>
      </section>
    </main>
  );
}

function OnlyCrabsHome() {
  const navigate = Route.useNavigate();
  const ensureSoulSeeds = useAction(api.seed.ensureSoulSeeds);
  const latest = (useQuery(api.souls.list, { limit: 12 }) as PublicSoul[]) ?? [];
  const [query, setQuery] = useState("");
  const seedEnsuredRef = useRef(false);
  const trimmedQuery = useMemo(() => query.trim(), [query]);

  useEffect(() => {
    if (seedEnsuredRef.current) return;
    seedEnsuredRef.current = true;
    void ensureSoulSeeds({});
  }, [ensureSoulSeeds]);

  return (
    <main>
      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy fade-up" data-delay="1">
            <span className="hero-badge">SOUL.md，共享。</span>
            <h1 className="hero-title">SoulHub，系统传说之家。</h1>
            <p className="hero-subtitle">
              分享 SOUL.md 包，像文档一样管理版本，将个人系统传说保存在一个公开的地方。
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <Link to="/upload" search={{ updateSlug: undefined }} className="btn btn-primary">
                发布 Soul
              </Link>
              <Link
                to="/souls"
                search={{
                  q: undefined,
                  sort: undefined,
                  dir: undefined,
                  view: undefined,
                  focus: undefined,
                }}
                className="btn"
              >
                浏览 Souls
              </Link>
            </div>
          </div>
          <div className="hero-card hero-search-card fade-up" data-delay="2">
            <form
              className="search-bar"
              onSubmit={(event) => {
                event.preventDefault();
                void navigate({
                  to: "/souls",
                  search: {
                    q: trimmedQuery || undefined,
                    sort: undefined,
                    dir: undefined,
                    view: undefined,
                    focus: undefined,
                  },
                });
              }}
            >
              <span className="mono">/</span>
              <input
                className="search-input"
                placeholder="搜索 Souls、提示词或传说"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </form>
            <div className="hero-install" style={{ marginTop: 18 }}>
              <div className="stat">搜索 Souls。版本管理，易于阅读，便于改编。</div>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">最新 Souls</h2>
        <p className="section-subtitle">平台上最新的 SOUL.md 包。</p>
        <div className="grid">
          {latest.length === 0 ? (
            <div className="card">暂无 Souls。成为第一个发布者！
          ) : (
            latest.map((soul) => (
              <SoulCard
                key={soul._id}
                soul={soul}
                summaryFallback="一个 SOUL.md 包。"
                meta={
                  <div className="stat">
                    <SoulStatsTripletLine stats={soul.stats} />
                  </div>
                }
              />
            ))
          )}
        </div>
        <div className="section-cta">
          <Link
            to="/souls"
            search={{
              q: undefined,
              sort: undefined,
              dir: undefined,
              view: undefined,
              focus: undefined,
            }}
            className="btn"
          >
            查看全部 Souls
          </Link>
        </div>
      </section>
    </main>
  );
}
