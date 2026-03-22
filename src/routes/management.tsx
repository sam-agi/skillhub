import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import {
  getSkillBadges,
  isSkillDeprecated,
  isSkillHighlighted,
  isSkillOfficial,
} from "../lib/badges";
import { isAdmin, isModerator } from "../lib/roles";
import { useAuthStatus } from "../lib/useAuthStatus";

const SKILL_AUDIT_LOG_LIMIT = 10;

type 管理mentUserSummary = {
  _id: Id<"users">;
  handle?: string | null;
  name?: string | null;
  displayName?: string | null;
};

type SkillAuditLogEntry = {
  _id: Id<"auditLogs">;
  action: string;
  metadata?: unknown;
  createdAt: number;
  actor: 管理mentUserSummary | null;
};

type 管理mentSkillEntry = {
  skill: Doc<"skills">;
  latestVersion: Doc<"skillVersions"> | null;
  owner: Doc<"users"> | null;
};

type ReportReasonEntry = {
  reason: string;
  createdAt: number;
  reporterHandle: string | null;
  reporterId: Id<"users">;
};

type ReportedSkillEntry = 管理mentSkillEntry & {
  reports: ReportReasonEntry[];
};

type RecentVersionEntry = {
  version: Doc<"skillVersions">;
  skill: Doc<"skills"> | null;
  owner: Doc<"users"> | null;
};

type DuplicateCandidateEntry = {
  skill: Doc<"skills">;
  latestVersion: Doc<"skillVersions"> | null;
  fingerprint: string | null;
  matches: Array<{ skill: Doc<"skills">; owner: Doc<"users"> | null }>;
  owner: Doc<"users"> | null;
};

type SkillBySlugResult = {
  skill: Doc<"skills">;
  latestVersion: Doc<"skillVersions"> | null;
  owner: Doc<"users"> | null;
  overrideReviewer: 管理mentUserSummary | null;
  auditLogs: SkillAuditLogEntry[];
  canonical: {
    skill: { slug: string; displayName: string };
    owner: { handle: string | null; userId: Id<"users"> | null };
  } | null;
} | null;

function resolveOwnerParam(handle: string | null | undefined, ownerId?: Id<"users">) {
  return handle?.trim() || (ownerId ? String(ownerId) : "unknown");
}

function promptBanReason(label: string) {
  const result = window.prompt(`Ban reason for ${label} (optional)`);
  if (result === null) return null;
  const trimmed = result.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const Route = createFileRoute("/management")({
  validateSearch: (search) => ({
    skill: typeof search.skill === "string" && search.skill.trim() ? search.skill : undefined,
  }),
  component: 管理ment,
});

function 管理ment() {
  const { me } = useAuthStatus();
  const search = Route.useSearch();
  const staff = isModerator(me);
  const admin = isAdmin(me);

  const selectedSlug = search.skill?.trim();
  const selectedSkill = useQuery(
    api.skills.getBySlugForStaff,
    staff && selectedSlug ? { slug: selectedSlug, auditLogLimit: SKILL_AUDIT_LOG_LIMIT } : "skip",
  ) as SkillBySlugResult | undefined;
  const selectedSkillId = selectedSkill?.skill?._id ?? null;
  const recentVersions = useQuery(api.skills.listRecentVersions, staff ? { limit: 20 } : "skip") as
    | RecentVersionEntry[]
    | undefined;
  const reportedSkills = useQuery(api.skills.listReportedSkills, staff ? { limit: 25 } : "skip") as
    | ReportedSkillEntry[]
    | undefined;
  const duplicateCandidates = useQuery(
    api.skills.listDuplicateCandidates,
    staff ? { limit: 20 } : "skip",
  ) as DuplicateCandidateEntry[] | undefined;

  const setRole = useMutation(api.users.setRole);
  const banUser = useMutation(api.users.banUser);
  const setBatch = useMutation(api.skills.setBatch);
  const setSoftDeleted = useMutation(api.skills.setSoftDeleted);
  const hardDelete = useMutation(api.skills.hardDelete);
  const changeOwner = useMutation(api.skills.changeOwner);
  const setDuplicate = useMutation(api.skills.setDuplicate);
  const setOfficialBadge = useMutation(api.skills.setOfficialBadge);
  const setDeprecatedBadge = useMutation(api.skills.setDeprecatedBadge);
  const setSkillManualOverride = useMutation(api.skills.setSkillManualOverride);
  const clearSkillManualOverride = useMutation(api.skills.clearSkillManualOverride);

  const [selectedDuplicate, setSelectedDuplicate] = useState("");
  const [selectedOwner, setSelectedOwner] = useState("");
  const [reportSearch, setReportSearch] = useState("");
  const [reportSearchDebounced, setReportSearchDebounced] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [userSearchDebounced, setUserSearchDebounced] = useState("");
  const [skillOverrideNote, setSkillOverrideNote] = useState("");

  const userQuery = userSearchDebounced.trim();
  const userResult = useQuery(
    api.users.list,
    admin ? { limit: 200, search: userQuery || undefined } : "skip",
  ) as { items: Doc<"users">[]; total: number } | undefined;

  const selectedOwnerUserId = selectedSkill?.skill?.ownerUserId ?? null;
  const selectedCanonicalSlug = selectedSkill?.canonical?.skill?.slug ?? "";

  useEffect(() => {
    if (!selectedSkillId || !selectedOwnerUserId) return;
    setSelectedDuplicate(selectedCanonicalSlug);
    setSelectedOwner(String(selectedOwnerUserId));
  }, [selectedCanonicalSlug, selectedOwnerUserId, selectedSkillId]);

  useEffect(() => {
    setSkillOverrideNote("");
  }, [selectedSkillId]);

  useEffect(() => {
    const handle = setTimeout(() => setReportSearchDebounced(reportSearch), 250);
    return () => clearTimeout(handle);
  }, [reportSearch]);

  useEffect(() => {
    const handle = setTimeout(() => setUserSearchDebounced(userSearch), 250);
    return () => clearTimeout(handle);
  }, [userSearch]);

  if (!staff) {
    return (
      <main className="section">
        <div className="card">仅限管理员。</div>
      </main>
    );
  }

  if (!recentVersions || !reportedSkills || !duplicateCandidates) {
    return (
      <main className="section">
        <div className="card">加载管理控制台…</div>
      </main>
    );
  }

  const reportQuery = reportSearchDebounced.trim().toLowerCase();
  const filteredReportedSkills = reportQuery
    ? reportedSkills.filter((entry) => {
        const reportReasons = (entry.reports ?? []).map((report) => report.reason).join(" ");
        const reporterHandles = (entry.reports ?? [])
          .map((report) => report.reporterHandle)
          .filter(Boolean)
          .join(" ");
        const haystack = [
          entry.skill.displayName,
          entry.skill.slug,
          entry.owner?.handle,
          entry.owner?.name,
          reportReasons,
          reporterHandles,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(reportQuery);
      })
    : reportedSkills;
  const reportCountLabel =
    filteredReportedSkills.length === 0 && reportedSkills.length > 0
      ? "无匹配的 reports。"
      : "暂无 reports。";
  const reportSummary = `显示 ${filteredReportedSkills.length} / ${reportedSkills.length}`;

  const filteredUsers = userResult?.items ?? [];
  const userTotal = userResult?.total ?? 0;
  const userSummary = userResult
    ? `显示 ${filteredUsers.length} / ${userTotal}`
    : "加载用户中…";
  const userEmptyLabel = userResult
    ? filteredUsers.length === 0
      ? userQuery
        ? "无匹配用户。"
        : "暂无用户。"
      : ""
    : "加载用户中…";

  const applySkillOverride = () => {
    if (!selectedSkill?.skill) return;
    void setSkillManualOverride({
      skillId: selectedSkill.skill._id,
      note: skillOverrideNote,
    })
      .then(() => {
        setSkillOverrideNote("");
      })
      .catch((error) => window.alert(formatMutationError(error)));
  };

  const clearSkillOverride = () => {
    if (!selectedSkill?.skill?.manualOverride) return;
    void clearSkillManualOverride({
      skillId: selectedSkill.skill._id,
      note: skillOverrideNote,
    })
      .then(() => {
        setSkillOverrideNote("");
      })
      .catch((error) => window.alert(formatMutationError(error)));
  };

  return (
    <main className="section">
      <h1 className="section-title">管理控制台</h1>
      <p className="section-subtitle">审核、策展和所有权工具。</p>

      <div className="card">
        <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
          被 Report 的 Skills
        </h2>
        <div className="management-controls">
          <div className="management-control management-search">
            <span className="mono">筛选</span>
            <input
              type="search"
              placeholder="搜索被 report 的 skills"
              value={reportSearch}
              onChange={(event) => setReportSearch(event.target.value)}
            />
          </div>
          <div className="management-count">{reportSummary}</div>
        </div>
        <div className="management-list">
          {filteredReportedSkills.length === 0 ? (
            <div className="stat">{reportCountLabel}</div>
          ) : (
            filteredReportedSkills.map((entry) => {
              const { skill, latestVersion, owner, reports } = entry;
              const ownerParam = resolveOwnerParam(
                owner?.handle ?? null,
                owner?._id ?? skill.ownerUserId,
              );
              const reportEntries = reports ?? [];
              return (
                <div key={skill._id} className="management-item">
                  <div className="management-item-main">
                    <Link to="/$owner/$slug" params={{ owner: ownerParam, slug: skill.slug }}>
                      {skill.displayName}
                    </Link>
                    <div className="section-subtitle" style={{ margin: 0 }}>
                      @{owner?.handle ?? owner?.name ?? "user"} · v{latestVersion?.version ?? "—"} ·
                      {skill.reportCount ?? 0} 个 report
                      {skill.lastReportedAt
                        ? ` · 最后 ${formatTimestamp(skill.lastReportedAt)}`
                        : ""}
                    </div>
                    {reportEntries.length > 0 ? (
                      <div className="management-sublist">
                        {reportEntries.map((report) => (
                          <div
                            key={`${report.reporterId}-${report.createdAt}`}
                            className="management-report-item"
                          >
                            <span className="management-report-meta">
                              {formatTimestamp(report.createdAt)}
                              {report.reporterHandle ? ` · @${report.reporterHandle}` : ""}
                            </span>
                            <span>{report.reason}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="section-subtitle" style={{ margin: 0 }}>
                        暂无 report 原因。
                      </div>
                    )}
                  </div>
                  <div className="management-actions">
                    <Link className="btn" to="/management" search={{ skill: skill.slug }}>
                      管理
                    </Link>
                    <button
                      className="btn"
                      type="button"
                      onClick={() =>
                        void setSoftDeleted({
                          skillId: skill._id,
                          deleted: !skill.softDeletedAt,
                        })
                      }
                    >
                      {skill.softDeletedAt ? "恢复" : "隐藏"}
                    </button>
                    {admin ? (
                      <button
                        className="btn"
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`硬删除 ${skill.displayName}?`)) return;
                          void hardDelete({ skillId: skill._id });
                        }}
                      >
                        硬删除
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
          Skill 工具
        </h2>
        {selectedSlug ? (
          <div className="section-subtitle" style={{ marginTop: 8 }}>
            管理 "{selectedSlug}" ·{" "}
            <Link to="/management" search={{ skill: undefined }}>
              清除选择
            </Link>
          </div>
        ) : null}
        <div className="management-list">
          {!selectedSlug ? (
            <div className="stat">点击 skill 上的管理按钮在此打开工具。</div>
          ) : selectedSkill === undefined ? (
            <div className="stat">加载 skill…</div>
          ) : !selectedSkill?.skill ? (
            <div className="stat">未找到 "{selectedSlug}" 的 skill。</div>
          ) : (
            (() => {
              const { skill, latestVersion, owner, canonical, overrideReviewer, auditLogs } =
                selectedSkill;
              const ownerParam = resolveOwnerParam(
                owner?.handle ?? null,
                owner?._id ?? skill.ownerUserId,
              );
              const moderationStatusRaw =
                skill.moderationStatus ?? (skill.softDeletedAt ? "hidden" : "active");
              const moderationStatusMap: Record<string, string> = {
                active: "活跃",
                hidden: "隐藏",
                removed: "已移除",
              };
              const moderationStatus = moderationStatusMap[moderationStatusRaw] || moderationStatusRaw;
              const isHighlighted = isSkillHighlighted(skill);
              const isOfficial = isSkillOfficial(skill);
              const isDeprecated = isSkillDeprecated(skill);
              const badges = getSkillBadges(skill);
              const ownerUserId = skill.ownerUserId ?? selectedOwnerUserId;
              const ownerHandle = owner?.handle ?? owner?.name ?? "user";
              const isOwnerAdmin = owner?.role === "admin";
              const canBanOwner =
                staff && ownerUserId && ownerUserId !== me?._id && (admin || !isOwnerAdmin);

              return (
                <div key={skill._id} className="management-item management-item-detail">
                  <div className="management-item-main">
                    <Link to="/$owner/$slug" params={{ owner: ownerParam, slug: skill.slug }}>
                      {skill.displayName}
                    </Link>
                    <div className="section-subtitle" style={{ margin: 0 }}>
                      @{owner?.handle ?? owner?.name ?? "user"} · v{latestVersion?.version ?? "—"} ·
                      更新于 {formatTimestamp(skill.updatedAt)} · {moderationStatus}
                      {badges.length ? ` · ${badges.map(b => {
                const badgeMap: Record<string, string> = {
                  official: "官方",
                  highlighted: "精选",
                  deprecated: "已弃用",
                };
                return badgeMap[b] || b;
              }).join(", ")}` : ""}
                    </div>
                    {skill.moderationFlags?.length ? (
                      <div className="management-tags">
                        {skill.moderationFlags.map((flag: string) => (
                          <span key={flag} className="tag">
                            {flag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="management-sublist">
                      <div className="section-subtitle" style={{ margin: 0 }}>
                        手动覆盖
                      </div>
                      <section className="management-override-panel">
                        <div className="management-report-item">
                          <span className="management-report-meta">当前覆盖</span>
                          <span>
                            {formatManualOverrideState(skill.manualOverride, overrideReviewer)}
                          </span>
                        </div>
                        <div className="management-report-item">
                          <span className="management-report-meta">最新版本</span>
                          <span>
                            {latestVersion ? `v${latestVersion.version}` : "无已发布版本。"}
                          </span>
                        </div>
                        <div className="management-report-item">
                          <span className="management-report-meta">行为</span>
                          <span>适用于整个 skill，直到 moderator 清除它。</span>
                        </div>
                        <textarea
                          className="form-input management-textarea"
                          rows={4}
                          placeholder={
                            skill.manualOverride
                              ? "需要审计备注以更新或清除 okay 覆盖"
                              : "需要审计备注以将此 skill 标记为 okay"
                          }
                          value={skillOverrideNote}
                          onChange={(event) => setSkillOverrideNote(event.target.value)}
                        />
                        <div className="management-actions management-actions-start">
                          <button
                            className="btn management-action-btn"
                            type="button"
                            disabled={!skillOverrideNote.trim()}
                            onClick={applySkillOverride}
                          >
                            {skill.manualOverride ? "更新 okay 覆盖" : "标记 skill 为 okay"}
                          </button>
                          {skill.manualOverride ? (
                            <button
                              className="btn management-action-btn"
                              type="button"
                              disabled={!skillOverrideNote.trim()}
                              onClick={clearSkillOverride}
                            >
                              清除 skill 覆盖
                            </button>
                          ) : null}
                        </div>
                      </section>
                    </div>
                    <div className="management-sublist">
                      <div className="section-subtitle" style={{ margin: 0 }}>
                        最近审计活动
                      </div>
                      <section className="management-override-panel management-audit-panel">
                        <div className="management-report-item">
                          <span className="management-report-meta">窗口</span>
                          <span>此 skill 最近 {SKILL_AUDIT_LOG_LIMIT} 条记录。</span>
                        </div>
                        {auditLogs.length === 0 ? (
                          <div className="section-subtitle" style={{ margin: 0 }}>
                            暂无审计活动。
                          </div>
                        ) : (
                          <div className="management-audit-list">
                            {auditLogs.map((entry) => {
                              const auditSummary = formatAuditMetadataSummary(
                                entry.action,
                                entry.metadata,
                              );
                              return (
                                <div key={entry._id} className="management-audit-item">
                                  <div className="management-report-item">
                                    <span className="management-report-meta">
                                      {formatTimestamp(entry.createdAt)} ·{" "}
                                      {format管理mentUserLabel(entry.actor)}
                                    </span>
                                    <span>
                                      {formatAuditActionLabel(entry.action, entry.metadata)}
                                    </span>
                                  </div>
                                  {auditSummary ? (
                                    <div className="section-subtitle management-audit-summary">
                                      {auditSummary}
                                    </div>
                                  ) : null}
                                  {entry.metadata ? (
                                    <details className="management-audit-details">
                                      <summary>metadata</summary>
                                      <pre className="management-audit-json">
                                        {JSON.stringify(entry.metadata, null, 2)}
                                      </pre>
                                    </details>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </section>
                    </div>
                    <div className="management-tool-grid">
                      <label className="management-control management-control-stack">
                        <span className="mono">duplicate of</span>
                        <input
                          className="management-field"
                          value={selectedDuplicate}
                          onChange={(event) => setSelectedDuplicate(event.target.value)}
                          placeholder={canonical?.skill?.slug ?? "canonical slug"}
                        />
                      </label>
                      <div className="management-control management-control-stack">
                        <span className="mono">duplicate 操作</span>
                        <button
                          className="btn management-action-btn"
                          type="button"
                          onClick={() =>
                            void setDuplicate({
                              skillId: skill._id,
                              canonicalSlug: selectedDuplicate.trim() || undefined,
                            })
                          }
                        >
                          设置 duplicate
                        </button>
                      </div>
                      {admin ? (
                        <>
                          <label className="management-control management-control-stack">
                            <span className="mono">owner</span>
                            <select
                              className="management-field"
                              value={selectedOwner}
                              onChange={(event) => setSelectedOwner(event.target.value)}
                            >
                              {filteredUsers.map((user) => (
                                <option key={user._id} value={user._id}>
                                  @{user.handle ?? user.name ?? "user"}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="management-control management-control-stack">
                            <span className="mono">所有者操作</span>
                            <button
                              className="btn management-action-btn"
                              type="button"
                              onClick={() =>
                                void changeOwner({
                                  skillId: skill._id,
                                  ownerUserId: selectedOwner as Doc<"users">["_id"],
                                })
                              }
                            >
                              更改所有者
                            </button>
                          </div>
                        </>
                      ) : null}
                    </div>
                  </div>
                  <div className="management-actions management-action-grid">
                    <Link
                      className="btn management-action-btn"
                      to="/$owner/$slug"
                      params={{ owner: ownerParam, slug: skill.slug }}
                    >
                      查看
                    </Link>
                    <button
                      className="btn management-action-btn"
                      type="button"
                      onClick={() =>
                        void setSoftDeleted({
                          skillId: skill._id,
                          deleted: !skill.softDeletedAt,
                        })
                      }
                    >
                      {skill.softDeletedAt ? "恢复" : "隐藏"}
                    </button>
                    <button
                      className="btn management-action-btn"
                      type="button"
                      onClick={() =>
                        void setBatch({
                          skillId: skill._id,
                          batch: isHighlighted ? undefined : "highlighted",
                        })
                      }
                    >
                      {isHighlighted ? "取消精选" : "精选"}
                    </button>
                    {admin ? (
                      <button
                        className="btn management-action-btn"
                        type="button"
                        onClick={() => {
                          if (!window.confirm(`硬删除 ${skill.displayName}?`)) return;
                          void hardDelete({ skillId: skill._id });
                        }}
                      >
                        硬删除
                      </button>
                    ) : null}
                    {staff ? (
                      <button
                        className="btn management-action-btn"
                        type="button"
                        disabled={!canBanOwner}
                        onClick={() => {
                          if (!ownerUserId || ownerUserId === me?._id) return;
                          if (!window.confirm(`Ban @${ownerHandle} and delete their skills?`)) {
                            return;
                          }
                          const reason = promptBanReason(`@${ownerHandle}`);
                          if (reason === null) return;
                          void banUser({ userId: ownerUserId, reason });
                        }}
                      >
                        封禁用户
                      </button>
                    ) : null}
                    {admin ? (
                      <>
                        <button
                          className="btn management-action-btn"
                          type="button"
                          onClick={() =>
                            void setOfficialBadge({
                              skillId: skill._id,
                              official: !isOfficial,
                            })
                          }
                        >
                          {isOfficial ? "移除官方" : "标记为官方"}
                        </button>
                        <button
                          className="btn management-action-btn"
                          type="button"
                          onClick={() =>
                            void setDeprecatedBadge({
                              skillId: skill._id,
                              deprecated: !isDeprecated,
                            })
                          }
                        >
                          {isDeprecated ? "移除弃用" : "标记为弃用"}
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              );
            })()
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
          Duplicate 候选
        </h2>
        <div className="management-list">
          {duplicateCandidates.length === 0 ? (
            <div className="stat">无 duplicate 候选。</div>
          ) : (
            duplicateCandidates.map((entry) => (
              <div key={entry.skill._id} className="management-item">
                <div className="management-item-main">
                  <Link
                    to="/$owner/$slug"
                    params={{
                      owner: resolveOwnerParam(
                        entry.owner?.handle ?? null,
                        entry.owner?._id ?? entry.skill.ownerUserId,
                      ),
                      slug: entry.skill.slug,
                    }}
                  >
                    {entry.skill.displayName}
                  </Link>
                  <div className="section-subtitle" style={{ margin: 0 }}>
                    @{entry.owner?.handle ?? entry.owner?.name ?? "user"} · v
                    {entry.latestVersion?.version ?? "—"} · fingerprint{" "}
                    {entry.fingerprint?.slice(0, 8)}
                  </div>
                  <div className="management-sublist">
                    {entry.matches.map((match) => (
                      <div key={match.skill._id} className="management-subitem">
                        <div>
                          <strong>{match.skill.displayName}</strong>
                          <div className="section-subtitle" style={{ margin: 0 }}>
                            @{match.owner?.handle ?? match.owner?.name ?? "user"} ·{" "}
                            {match.skill.slug}
                          </div>
                        </div>
                        <div className="management-actions">
                          <Link
                            className="btn"
                            to="/$owner/$slug"
                            params={{
                              owner: resolveOwnerParam(
                                match.owner?.handle ?? null,
                                match.owner?._id ?? match.skill.ownerUserId,
                              ),
                              slug: match.skill.slug,
                            }}
                          >
                            View
                          </Link>
                          <button
                            className="btn"
                            type="button"
                            onClick={() =>
                              void setDuplicate({
                                skillId: entry.skill._id,
                                canonicalSlug: match.skill.slug,
                              })
                            }
                          >
                            标记为 duplicate
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="management-actions">
                  <Link
                    className="btn"
                    to="/$owner/$slug"
                    params={{
                      owner: resolveOwnerParam(
                        entry.owner?.handle ?? null,
                        entry.owner?._id ?? entry.skill.ownerUserId,
                      ),
                      slug: entry.skill.slug,
                    }}
                  >
                    View
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
          最近推送
        </h2>
        <div className="management-list">
          {recentVersions.length === 0 ? (
            <div className="stat">无最近版本。</div>
          ) : (
            recentVersions.map((entry) => (
              <div key={entry.version._id} className="management-item">
                <div className="management-item-main">
                  <strong>{entry.skill?.displayName ?? "未知 skill"}</strong>
                  <div className="section-subtitle" style={{ margin: 0 }}>
                    v{entry.version.version} · @{entry.owner?.handle ?? entry.owner?.name ?? "user"}
                  </div>
                </div>
                <div className="management-actions">
                  {entry.skill ? (
                    <Link className="btn" to="/management" search={{ skill: entry.skill.slug }}>
                      管理
                    </Link>
                  ) : null}
                  {entry.skill ? (
                    <Link
                      className="btn"
                      to="/$owner/$slug"
                      params={{
                        owner: resolveOwnerParam(
                          entry.owner?.handle ?? null,
                          entry.owner?._id ?? entry.skill.ownerUserId,
                        ),
                        slug: entry.skill.slug,
                      }}
                    >
                      View
                    </Link>
                  ) : null}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {admin ? (
        <div className="card" style={{ marginTop: 20 }}>
          <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
            Users
          </h2>
          <div className="management-controls">
            <div className="management-control management-search">
              <span className="mono">Filter</span>
              <input
                type="search"
                placeholder="搜索用户"
                value={userSearch}
                onChange={(event) => setUserSearch(event.target.value)}
              />
            </div>
            <div className="management-count">{userSummary}</div>
          </div>
          <div className="management-list">
            {filteredUsers.length === 0 ? (
              <div className="stat">{userEmptyLabel}</div>
            ) : (
              filteredUsers.map((user) => (
                <div key={user._id} className="management-item">
                  <div className="management-item-main">
                    <span className="mono">@{user.handle ?? user.name ?? "user"}</span>
                    {user.deletedAt || user.deactivatedAt ? (
                      <div className="section-subtitle" style={{ margin: 0 }}>
                        {user.banReason && user.deletedAt
                          ? `Banned ${formatTimestamp(user.deletedAt)} · ${user.banReason}`
                          : `Deleted ${formatTimestamp((user.deactivatedAt ?? user.deletedAt) as number)}`}
                      </div>
                    ) : null}
                  </div>
                  <div className="management-actions">
                    <select
                      value={user.role ?? "user"}
                      onChange={(event) => {
                        const value = event.target.value;
                        if (value === "admin" || value === "moderator" || value === "user") {
                          void setRole({ userId: user._id, role: value });
                        }
                      }}
                    >
                      <option value="user">用户</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                    </select>
                    <button
                      className="btn"
                      type="button"
                      disabled={user._id === me?._id}
                      onClick={() => {
                        if (user._id === me?._id) return;
                        if (
                          !window.confirm(
                            `封禁 @${user.handle ?? user.name ?? "user"} 并删除其 skills？`,
                          )
                        ) {
                          return;
                        }
                        const label = `@${user.handle ?? user.name ?? "user"}`;
                        const reason = promptBanReason(label);
                        if (reason === null) return;
                        void banUser({ userId: user._id, reason });
                      }}
                    >
                      封禁用户
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

function formatTimestamp(value: number) {
  return new Date(value).toLocaleString();
}

function formatMutationError(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return "请求失败。";
}

function formatManualOverrideState(
  override:
    | {
        verdict: string;
        note: string;
        reviewerUserId: string;
        updatedAt: number;
      }
    | null
    | undefined,
  reviewer?: ManagementUserSummary | null,
) {
  if (!override) return "无覆盖。";
  return `${formatVerdictLabel(override.verdict)} · reviewer ${format管理mentUserLabel(reviewer, override.reviewerUserId)} · updated ${formatTimestamp(
    override.updatedAt,
  )} · ${override.note}`;
}

function formatManagementUserLabel(
  user: ManagementUserSummary | null | undefined,
  fallbackId?: string | null,
) {
  if (user?.handle?.trim()) return `@${user.handle.trim()}`;
  if (user?.displayName?.trim()) return user.displayName.trim();
  if (user?.name?.trim()) return user.name.trim();
  if (fallbackId?.trim()) return fallbackId.trim();
  return "未知用户";
}

function formatAuditActionLabel(action: string, metadata?: unknown) {
  const record = asAuditMetadataRecord(metadata);
  if (action === "skill.manual_override.set") {
    const verdict = typeof record?.verdict === "string" ? record.verdict : "unknown";
    return `覆盖设置为 ${formatVerdictLabel(verdict)}`;
  }
  if (action === "skill.manual_override.clear") {
    return "覆盖已清除";
  }
  if (action === "skill.owner.change") {
    return "所有者已更改";
  }
  if (action === "skill.duplicate.set") {
    return "Duplicate 目标已设置";
  }
  if (action === "skill.duplicate.clear") {
    return "Duplicate 目标已清除";
  }
  if (action === "skill.auto_hide") {
    return "Skill 已自动隐藏";
  }
  if (action === "skill.hard_delete") {
    return "Skill 已硬删除";
  }
  if (action.startsWith("skill.transfer.")) {
    return `转移 ${action.slice("skill.transfer.".length).replaceAll("_", " ")}`;
  }
  if (action.startsWith("skill.")) {
    return action.slice("skill.".length).replaceAll(".", " ").replaceAll("_", " ");
  }
  return action.replaceAll(".", " ").replaceAll("_", " ");
}

function formatAuditMetadataSummary(action: string, metadata?: unknown) {
  const record = asAuditMetadataRecord(metadata);
  if (!record) return null;

  if (action === "skill.manual_override.set") {
    const note = typeof record.note === "string" ? record.note.trim() : "";
    if (note) return note;
    const previousVerdict =
      typeof record.previousVerdict === "string" ? record.previousVerdict : null;
    return previousVerdict ? `之前裁决： ${formatVerdictLabel(previousVerdict)}` : null;
  }

  if (action === "skill.manual_override.clear") {
    const note = typeof record.note === "string" ? record.note.trim() : "";
    if (note) return note;
    const previousVerdict =
      typeof record.previousVerdict === "string" ? record.previousVerdict : null;
    return previousVerdict
      ? `之前覆盖裁决： ${formatVerdictLabel(previousVerdict)}`
      : null;
  }

  if (action === "skill.owner.change") {
    const from = typeof record.from === "string" ? record.from : null;
    const to = typeof record.to === "string" ? record.to : null;
    if (from || to) return `从 ${from ?? "未知"} 到 ${to ?? "未知"}`;
  }

  if (action === "skill.duplicate.set") {
    return typeof record.canonicalSlug === "string"
      ? `Canonical skill： ${record.canonicalSlug}`
      : null;
  }

  if (action === "skill.duplicate.clear") {
    return "Canonical skill 已清除。";
  }

  if (action === "skill.auto_hide") {
    return typeof record.reportCount === "number" ? `${record.reportCount} 个活跃 reports` : null;
  }

  if (action === "skill.hard_delete") {
    return typeof record.slug === "string" ? `已删除 slug： ${record.slug}` : null;
  }

  if (typeof record.note === "string" && record.note.trim()) {
    return record.note.trim();
  }
  if (typeof record.reason === "string" && record.reason.trim()) {
    return record.reason.trim();
  }
  return null;
}

function asAuditMetadataRecord(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  return metadata as Record<string, unknown>;
}

function formatVerdictLabel(verdict: string) {
  const verdictMap: Record<string, string> = {
    clean: "干净",
    okay: "正常",
    suspicious: "可疑",
    malicious: "恶意",
  };
  return verdictMap[verdict] || verdict;
}
