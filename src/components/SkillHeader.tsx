import { Link } from "@tanstack/react-router";
import {
  type SkilldisSkillMetadata,
  PLATFORM_SKILL_LICENSE,
  PLATFORM_SKILL_LICENSE_SUMMARY,
} from "skillhub-schema";
import { Package } from "lucide-react";
import type { Doc, Id } from "../../convex/_generated/dataModel";
import { getSkillBadges } from "../lib/badges";
import { formatCompactStat, formatSkillStatsTriplet } from "../lib/numberFormat";
import type { PublicSkill, PublicUser } from "../lib/publicUser";
import { getRuntimeEnv } from "../lib/runtimeEnv";
import { SkillInstallCard } from "./SkillInstallCard";
import { type LlmAnalysis, SecurityScanResults } from "./SkillSecurityScanResults";
import { UserBadge } from "./UserBadge";

export type SkillModerationInfo = {
  isPendingScan: boolean;
  isMalwareBlocked: boolean;
  isSuspicious: boolean;
  isHiddenByMod: boolean;
  isRemoved: boolean;
  overrideActive?: boolean;
  verdict?: "clean" | "suspicious" | "malicious";
  reason?: string;
};

type SkillFork = {
  kind: "fork" | "duplicate";
  version: string | null;
  skill: { slug: string; displayName: string };
  owner: { handle: string | null; userId: Id<"users"> | null };
};

type SkillCanonical = {
  skill: { slug: string; displayName: string };
  owner: { handle: string | null; userId: Id<"users"> | null };
};

type SkillHeaderProps = {
  skill: Doc<"skills"> | PublicSkill;
  owner: Doc<"users"> | PublicUser | null;
  ownerHandle: string | null;
  latestVersion: Doc<"skillVersions"> | null;
  modInfo: SkillModerationInfo | null;
  can管理: boolean;
  isAuthenticated: boolean;
  isStaff: boolean;
  isStarred: boolean | undefined;
  onToggleStar: () => void;
  onOpenReport: () => void;
  forkOf: SkillFork | null;
  forkOfLabel: string;
  forkOfHref: string | null;
  forkOfOwnerHandle: string | null;
  canonical: SkillCanonical | null;
  canonicalHref: string | null;
  canonicalOwnerHandle: string | null;
  staffModerationNote: string | null;
  staffVisibilityTag: string | null;
  isAutoHidden: boolean;
  isRemoved: boolean;
  nixPlugin: string | undefined;
  hasPluginBundle: boolean;
  configRequirements: SkilldisSkillMetadata["config"] | undefined;
  cliHelp: string | undefined;
  tagEntries: Array<[string, Id<"skillVersions">]>;
  versionById: Map<Id<"skillVersions">, Doc<"skillVersions">>;
  tagName: string;
  onTagNameChange: (value: string) => void;
  tagVersionId: Id<"skillVersions"> | "";
  onTagVersionChange: (value: Id<"skillVersions"> | "") => void;
  onTagSubmit: () => void;
  tagVersions: Doc<"skillVersions">[];
  clawdis: SkilldisSkillMetadata | undefined;
  osLabels: string[];
};

export function SkillHeader({
  skill,
  owner,
  ownerHandle,
  latestVersion,
  modInfo,
  canManage,
  isAuthenticated,
  isStaff,
  isStarred,
  onToggleStar,
  onOpenReport,
  forkOf,
  forkOfLabel,
  forkOfHref,
  forkOfOwnerHandle,
  canonical,
  canonicalHref,
  canonicalOwnerHandle,
  staffModerationNote,
  staffVisibilityTag,
  isAutoHidden,
  isRemoved,
  nixPlugin,
  hasPluginBundle,
  configRequirements,
  cliHelp,
  tagEntries,
  versionById,
  tagName,
  onTagNameChange,
  tagVersionId,
  onTagVersionChange,
  onTagSubmit,
  tagVersions,
  clawdis,
  osLabels,
}: SkillHeaderProps) {
  const convexSiteUrl = getRuntimeEnv("VITE_CONVEX_SITE_URL") ?? "https://skillhub.ai";
  const formattedStats = formatSkillStatsTriplet(skill.stats);
  const suppressScanResults =
    !isStaff &&
    Boolean(modInfo?.overrideActive) &&
    !modInfo?.isMalwareBlocked &&
    !modInfo?.isSuspicious;
  const overrideScanMessage = suppressScanResults
    ? "安全审查结果已由 staff 审核并批准公开使用。"
    : null;

  return (
    <>
      {modInfo?.isPendingScan ? (
        <div className="pending-banner">
          <div className="pending-banner-content">
            <strong>Security scan in progress</strong>
            <p>
              您的 skill 正在被 VirusTotal 扫描。扫描完成后其他人将能看到它。这通常需要最多 5 分钟——喝杯咖啡或清理一下 shell 等待吧。
            </p>
          </div>
        </div>
      ) : modInfo?.isMalwareBlocked ? (
        <div className="pending-banner pending-banner-blocked">
          <div className="pending-banner-content">
            <strong>Skill blocked — malicious content detected</strong>
            <p>
              SkillHub Security 将此 skill 标记为恶意。下载已禁用。请查看下方的扫描结果。
            </p>
          </div>
        </div>
      ) : modInfo?.isSuspicious ? (
        <div className="pending-banner pending-banner-warning">
          <div className="pending-banner-content">
            <strong>Skill flagged — suspicious patterns detected</strong>
            <p>
              SkillHub Security 将此 skill 标记为可疑。使用前请查看扫描结果。
            </p>
            {canManage ? (
              <p className="pending-banner-appeal">
                如果您认为此 skill 被错误标记，请{" "}
                <a
                  href="https://github.com/openclaw/skillhub/issues"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  在 GitHub 上提交 issue
                </a>{" "}
                我们会解释为什么被标记以及您可以做什么。
              </p>
            ) : null}
          </div>
        </div>
      ) : modInfo?.isRemoved ? (
        <div className="pending-banner pending-banner-blocked">
          <div className="pending-banner-content">
            <strong>Skill removed by moderator</strong>
            <p>此 skill 已被移除，其他人无法看到。</p>
          </div>
        </div>
      ) : modInfo?.isHiddenByMod ? (
        <div className="pending-banner pending-banner-blocked">
          <div className="pending-banner-content">
            <strong>Skill hidden</strong>
            <p>此 skill 当前已隐藏，其他人无法看到。</p>
          </div>
        </div>
      ) : null}

      <div className="card skill-hero">
        <div className={`skill-hero-top${hasPluginBundle ? " has-plugin" : ""}`}>
          <div className="skill-hero-header">
            <div className="skill-hero-title">
              <div className="skill-hero-title-row">
                <h1 className="section-title" style={{ margin: 0 }}>
                  {skill.displayName}
                </h1>
                {nixPlugin ? <span className="tag tag-accent">Plugin bundle (nix)</span> : null}
              </div>
              <p className="section-subtitle">{skill.summary ?? "未提供 summary。"}</p>

              {isStaff && staffModerationNote ? (
                <div className="skill-hero-note">{staffModerationNote}</div>
              ) : null}
              {nixPlugin ? (
                <div className="skill-hero-note">
                  将 skill pack、CLI binary 和 config 需求捆绑在一个 Nix 安装中。
                </div>
              ) : null}
              <div className="skill-hero-note">
                <strong>{PLATFORM_SKILL_LICENSE}</strong> · {PLATFORM_SKILL_LICENSE_SUMMARY}
              </div>
              <div className="stat">
                ⭐ {formattedStats.stars} · <Package size={14} aria-hidden="true" />{" "}
                {formattedStats.downloads} · {formatCompactStat(skill.stats.installsCurrent ?? 0)}{" "}
                当前安装 · {formattedStats.installsAllTime} 总安装
              </div>
              <div className="stat">
                <UserBadge
                  user={owner}
                  fallbackHandle={ownerHandle}
                  prefix="by"
                  size="md"
                  showName
                />
              </div>
              {forkOf && forkOfHref ? (
                <div className="stat">
                  {forkOfLabel}{" "}
                  <a href={forkOfHref}>
                    {forkOfOwnerHandle ? `@${forkOfOwnerHandle}/` : ""}
                    {forkOf.skill.slug}
                  </a>
                  {forkOf.version ? ` (based on ${forkOf.version})` : null}
                </div>
              ) : null}
              {canonicalHref ? (
                <div className="stat">
                  canonical:{" "}
                  <a href={canonicalHref}>
                    {canonicalOwnerHandle ? `@${canonicalOwnerHandle}/` : ""}
                    {canonical?.skill?.slug}
                  </a>
                </div>
              ) : null}
              {getSkillBadges(skill).map((badge) => (
                <div key={badge} className="tag">
                  {badge}
                </div>
              ))}
              <div className="tag tag-accent">{PLATFORM_SKILL_LICENSE}</div>
              {isStaff && staffVisibilityTag ? (
                <div className={`tag${isAutoHidden || isRemoved ? " tag-accent" : ""}`}>
                  {staffVisibilityTag}
                </div>
              ) : null}
              <div className="skill-actions">
                {isAuthenticated ? (
                  <button
                    className={`star-toggle${isStarred ? " is-active" : ""}`}
                    type="button"
                    onClick={onToggleStar}
                    aria-label={isStarred ? "取消 star skill" : "Star skill"}
                  >
                    <span aria-hidden="true">★</span>
                  </button>
                ) : null}
                {isAuthenticated ? (
                  <button className="btn btn-ghost" type="button" onClick={onOpenReport}>
                    Report
                  </button>
                ) : null}
                {isStaff ? (
                  <Link className="btn" to="/management" search={{ skill: skill.slug }}>
                    Manage
                  </Link>
                ) : null}
              </div>
              {suppressScanResults ? (
                <div className="skill-hero-note">{overrideScanMessage}</div>
              ) : latestVersion?.sha256hash ||
                latestVersion?.llmAnalysis ||
                (latestVersion?.staticScan?.findings?.length ?? 0) > 0 ? (
                <SecurityScanResults
                  sha256hash={latestVersion?.sha256hash}
                  vtAnalysis={latestVersion?.vtAnalysis}
                  llmAnalysis={latestVersion?.llmAnalysis as LlmAnalysis | undefined}
                  staticFindings={latestVersion?.staticScan?.findings}
                />
              ) : null}
              {!suppressScanResults &&
              (latestVersion?.sha256hash ||
                latestVersion?.llmAnalysis ||
                (latestVersion?.staticScan?.findings?.length ?? 0) > 0) ? (
                <p className="scan-disclaimer">
                  像龙虾壳一样，安全有多层保护——运行前请审查代码。
                </p>
              ) : null}
            </div>
            <div className="skill-hero-cta">
              <div className="skill-version-pill">
                <span className="skill-version-label">当前版本</span>
                <strong>v{latestVersion?.version ?? "—"}</strong>
              </div>
              {!nixPlugin && !modInfo?.isMalwareBlocked && !modInfo?.isRemoved ? (
                <a
                  className="btn btn-primary"
                  href={`${convexSiteUrl}/api/v1/download?slug=${skill.slug}`}
                >
                  下载 zip
                </a>
              ) : null}
            </div>
          </div>
          {hasPluginBundle ? (
            <div className="skill-panel bundle-card">
              <div className="bundle-header">
                <div className="bundle-title">Plugin bundle (nix)</div>
                <div className="bundle-subtitle">Skill pack · CLI binary · Config</div>
              </div>
              <div className="bundle-includes">
                <span>SKILL.md</span>
                <span>CLI</span>
                <span>Config</span>
              </div>
              {configRequirements ? (
                <div className="bundle-section">
                  <div className="bundle-section-title">Config 需求</div>
                  <div className="bundle-meta">
                    {configRequirements.requiredEnv?.length ? (
                      <div className="stat">
                        <strong>必需 env</strong>
                        <span>{configRequirements.requiredEnv.join(", ")}</span>
                      </div>
                    ) : null}
                    {configRequirements.stateDirs?.length ? (
                      <div className="stat">
                        <strong>State dirs</strong>
                        <span>{configRequirements.stateDirs.join(", ")}</span>
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}
              {cliHelp ? (
                <details className="bundle-section bundle-details">
                  <summary>CLI help（来自 plugin）</summary>
                  <pre className="hero-install-code mono">{cliHelp}</pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="skill-tag-row">
          {tagEntries.length === 0 ? (
            <span className="section-subtitle" style={{ margin: 0 }}>
              暂无 tags。
            </span>
          ) : (
            tagEntries.map(([tag, versionId]) => (
              <span key={tag} className="tag">
                {tag}
                <span className="tag-meta">
                  v{versionById.get(versionId)?.version ?? versionId}
                </span>
              </span>
            ))
          )}
        </div>

        {canManage ? (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              onTagSubmit();
            }}
            className="tag-form"
          >
            <input
              className="search-input"
              value={tagName}
              onChange={(event) => onTagNameChange(event.target.value)}
              placeholder="latest"
            />
            <select
              className="search-input"
              value={tagVersionId ?? ""}
              onChange={(event) => onTagVersionChange(event.target.value as Id<"skillVersions">)}
            >
              {tagVersions.map((version) => (
                <option key={version._id} value={version._id}>
                  v{version.version}
                </option>
              ))}
            </select>
            <button className="btn" type="submit">
              更新 tag
            </button>
          </form>
        ) : null}

        <SkillInstallCard clawdis={clawdis} osLabels={osLabels} />
      </div>
    </>
  );
}
