import { getRuntimeEnv } from "../lib/runtimeEnv";
import { type LlmAnalysis, SecurityScanResults } from "./SkillSecurityScanResults";

export function SkillVersionsPanel({
  versions,
  nixPlugin,
  skillSlug,
  suppressScanResults,
  suppressedMessage,
}: SkillVersionsPanelProps) {
  const convexSiteUrl = getRuntimeEnv("VITE_CONVEX_SITE_URL") ?? "https://skillhub.ai";
  return (
    <div className="tab-body">
      <div>
        <h2 className="section-title" style={{ fontSize: "1.2rem", margin: 0 }}>
          Versions
        </h2>
        <p className="section-subtitle" style={{ margin: 0 }}>
          {nixPlugin
            ? "查看 release 历史和 changelog。"
            : "下载旧版本或查看 changelog。"}
        </p>
        {suppressedMessage ? <p className="section-subtitle">{suppressedMessage}</p> : null}
      </div>
      <div className="version-scroll">
        <div className="version-list">
          {(versions ?? []).map((version) => (
            <div key={version._id} className="version-row">
              <div className="version-info">
                <div>
                  v{version.version} · {new Date(version.createdAt).toLocaleDateString()}
                  {version.changelogSource === "自动" ? (
                    <span style={{ color: "var(--ink-soft)" }}> · auto</span>
                  ) : null}
                </div>
                <div style={{ color: "#5c554e", whiteSpace: "pre-wrap" }}>{version.changelog}</div>
                <div className="version-scan-results">
                  {!suppressScanResults && (version.sha256hash || version.llmAnalysis) ? (
                    <SecurityScanResults
                      sha256hash={version.sha256hash}
                      vtAnalysis={version.vtAnalysis}
                      llmAnalysis={version.llmAnalysis as LlmAnalysis | undefined}
                      variant="badge"
                    />
                  ) : null}
                </div>
              </div>
              {!nixPlugin ? (
                <div className="version-actions">
                  <a
                    className="btn version-zip"
                    href={`${convexSiteUrl}/api/v1/download?slug=${skillSlug}&version=${version.version}`}
                  >
                    Zip
                  </a>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
