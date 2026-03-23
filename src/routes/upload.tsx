import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import {
  PLATFORM_SKILL_LICENSE,
  PLATFORM_SKILL_LICENSE_NAME,
  PLATFORM_SKILL_LICENSE_SUMMARY,
} from "skillhub-schema";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import semver from "semver";
import { api } from "../../convex/_generated/api";
import { getSiteMode } from "../lib/site";
import { getPublicSlugCollision } from "../lib/slugCollision";
import { expandDroppedItems, expandFilesWithReport } from "../lib/uploadFiles";
import { useAuthStatus } from "../lib/useAuthStatus";
import {
  formatBytes,
  formatPublishError,
  hashFile,
  isTextFile,
  readText,
  uploadFile,
} from "./upload/-utils";

const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const Route = createFileRoute("/upload")({
  validateSearch: (search) => ({
    updateSlug: typeof search.updateSlug === "string" ? search.updateSlug : undefined,
  }),
  component: Upload,
});

export function Upload() {
  const { isAuthenticated, me } = useAuthStatus();
  const { updateSlug } = useSearch({ from: "/upload" });
  const siteMode = getSiteMode();
  const isSoulMode = siteMode === "souls";
  const requiredFileLabel = isSoulMode ? "SOUL.md" : "SKILL.md";
  const contentLabel = isSoulMode ? "soul" : "skill";

  const generateUploadUrl = useMutation(api.uploads.generateUploadUrl);
  const publishVersion = useAction(
    isSoulMode ? api.souls.publishVersion : api.skills.publishVersion,
  );
  const generateChangelogPreview = useAction(
    isSoulMode ? api.souls.generateChangelogPreview : api.skills.generateChangelogPreview,
  );
  const existingSkill = useQuery(
    api.skills.getBySlug,
    !isSoulMode && updateSlug ? { slug: updateSlug } : "skip",
  );
  const existingSoul = useQuery(
    api.souls.getBySlug,
    isSoulMode && updateSlug ? { slug: updateSlug } : "skip",
  );
  const existing = (isSoulMode ? existingSoul : existingSkill) as
    | {
        skill?: { slug: string; displayName: string };
        soul?: { slug: string; displayName: string };
        latestVersion?: { version: string };
      }
    | null
    | undefined;

  const [hasAttempted, setHasAttempted] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [ignoredMacJunkPaths, setIgnoredMacJunkPaths] = useState<string[]>([]);
  const [slug, setSlug] = useState(updateSlug ?? "");
  const [displayName, setDisplayName] = useState("");
  const [version, setVersion] = useState("1.0.0");
  const [tags, setTags] = useState("latest");
  const [acceptedLicenseTerms, setAcceptedLicenseTerms] = useState(false);
  const [changelog, setChangelog] = useState("");
  const [changelogStatus, setChangelogStatus] = useState<"idle" | "loading" | "ready" | "error">(
    "idle",
  );
  const [changelogSource, setChangelogSource] = useState<"auto" | "user" | null>(null);
  const changelogTouchedRef = useRef(false);
  const changelogRequestRef = useRef(0);
  const changelogKeyRef = useRef<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const isSubmitting = status !== null;
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const setFileInputRef = (node: HTMLInputElement | null) => {
    fileInputRef.current = node;
    if (node) {
      node.setAttribute("webkitdirectory", "");
      node.setAttribute("directory", "");
    }
  };
  const validationRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const maxBytes = 50 * 1024 * 1024;
  const totalBytes = useMemo(() => files.reduce((sum, file) => sum + file.size, 0), [files]);
  const stripRoot = useMemo(() => {
    if (files.length === 0) return null;
    const paths = files.map((file) => (file.webkitRelativePath || file.name).replace(/^\.\//, ""));
    if (!paths.every((path) => path.includes("/"))) return null;
    const firstSegment = paths[0]?.split("/")[0];
    if (!firstSegment) return null;
    if (!paths.every((path) => path.startsWith(`${firstSegment}/`))) return null;
    return firstSegment;
  }, [files]);
  const normalizedPaths = useMemo(
    () =>
      files.map((file) => {
        const raw = (file.webkitRelativePath || file.name).replace(/^\.\//, "");
        if (stripRoot && raw.startsWith(`${stripRoot}/`)) {
          return raw.slice(stripRoot.length + 1);
        }
        return raw;
      }),
    [files, stripRoot],
  );
  const hasRequiredFile = useMemo(
    () =>
      normalizedPaths.some((path) => {
        const lower = path.trim().toLowerCase();
        return isSoulMode ? lower === "soul.md" : lower === "skill.md" || lower === "skills.md";
      }),
    [isSoulMode, normalizedPaths],
  );
  const sizeLabel = totalBytes ? formatBytes(totalBytes) : "0 B";
  const ignoredMacJunkNote = useMemo(() => {
    if (ignoredMacJunkPaths.length === 0) return null;
    const labels = Array.from(
      new Set(ignoredMacJunkPaths.map((path) => path.split("/").at(-1) ?? path)),
    ).slice(0, 3);
    const suffix = ignoredMacJunkPaths.length > 3 ? ", ..." : "";
    const count = ignoredMacJunkPaths.length;
    return `已忽略 ${count} 个 macOS junk 文件${count === 1 ? "" : ""} (${labels.join(", ")}${suffix})`;
  }, [ignoredMacJunkPaths]);
  const trimmedSlug = slug.trim();
  const trimmedName = displayName.trim();
  const trimmedChangelog = changelog.trim();
  const slugAvailability = useQuery(
    api.skills.checkSlugAvailability,
    !isSoulMode && isAuthenticated && trimmedSlug && SLUG_PATTERN.test(trimmedSlug)
      ? { slug: trimmedSlug.toLowerCase() }
      : "skip",
  ) as
    | {
        available: boolean;
        reason: "available" | "taken" | "reserved";
        message: string | null;
        url: string | null;
      }
    | null
    | undefined;
  const slugCollision = useMemo(
    () =>
      getPublicSlugCollision({
        isSoulMode,
        slug: trimmedSlug,
        result: slugAvailability,
      }),
    [isSoulMode, slugAvailability, trimmedSlug],
  );

  useEffect(() => {
    if (!existing?.latestVersion || (!existing?.skill && !existing?.soul)) return;
    const name = existing.skill?.displayName ?? existing.soul?.displayName;
    const nextSlug = existing.skill?.slug ?? existing.soul?.slug;
    if (nextSlug) setSlug(nextSlug);
    if (name) setDisplayName(name);
    const nextVersion = semver.inc(existing.latestVersion.version, "patch");
    if (nextVersion) setVersion(nextVersion);
  }, [existing]);

  useEffect(() => {
    if (changelogTouchedRef.current) return;
    if (trimmedChangelog) return;
    if (!trimmedSlug || !SLUG_PATTERN.test(trimmedSlug)) return;
    if (!semver.valid(version)) return;
    if (!hasRequiredFile) return;
    if (files.length === 0) return;

    const requiredIndex = normalizedPaths.findIndex((path) => {
      const lower = path.trim().toLowerCase();
      return isSoulMode ? lower === "soul.md" : lower === "skill.md" || lower === "skills.md";
    });
    if (requiredIndex < 0) return;

    const requiredFile = files[requiredIndex];
    if (!requiredFile) return;

    const key = `${trimmedSlug}:${version}:${requiredFile.size}:${requiredFile.lastModified}:${normalizedPaths.length}`;
    if (changelogKeyRef.current === key) return;
    changelogKeyRef.current = key;

    const requestId = ++changelogRequestRef.current;
    setChangelogStatus("loading");

    void readText(requiredFile)
      .then((text) => {
        if (changelogRequestRef.current !== requestId) return null;
        return generateChangelogPreview({
          slug: trimmedSlug,
          version,
          readmeText: text.slice(0, 20_000),
          filePaths: normalizedPaths,
        });
      })
      .then((result) => {
        if (!result) return;
        if (changelogRequestRef.current !== requestId) return;
        setChangelog(result.changelog);
        setChangelogSource("auto");
        setChangelogStatus("ready");
      })
      .catch(() => {
        if (changelogRequestRef.current !== requestId) return;
        setChangelogStatus("error");
      });
  }, [
    files,
    generateChangelogPreview,
    hasRequiredFile,
    isSoulMode,
    normalizedPaths,
    trimmedChangelog,
    trimmedSlug,
    version,
  ]);
  const parsedTags = useMemo(
    () =>
      tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tags],
  );
  const validation = useMemo(() => {
    const issues: string[] = [];
    if (!trimmedSlug) {
      issues.push("Slug 是必填项。");
    } else if (!SLUG_PATTERN.test(trimmedSlug)) {
      issues.push("Slug 必须是小写且只能使用连字符。");
    }
    if (!trimmedName) {
      issues.push("Display name 是必填项。");
    }
    if (!semver.valid(version)) {
      issues.push("Version 必须是有效的 semver（例如 1.0.0）。");
    }
    if (parsedTags.length === 0) {
      issues.push("至少需要填写一个 tag。");
    }
    if (!isSoulMode && !acceptedLicenseTerms) {
      issues.push("接受 MIT-0 license 条款以发布此 skill。");
    }
    if (files.length === 0) {
      issues.push("至少添加一个文件。");
    }
    if (!hasRequiredFile) {
      issues.push(`需要 ${requiredFileLabel}。`);
    }
    const invalidFiles = files.filter((file) => !isTextFile(file));
    if (invalidFiles.length > 0) {
      issues.push(
        `移除非文本文件： ${invalidFiles
          .slice(0, 3)
          .map((file) => file.name)
          .join(", ")}`,
      );
    }
    if (totalBytes > maxBytes) {
      issues.push("文件总大小超过 50MB。");
    }
    if (slugCollision) {
      issues.push(slugCollision.message);
    }
    return {
      issues,
      ready: issues.length === 0,
    };
  }, [
    trimmedSlug,
    trimmedName,
    version,
    parsedTags.length,
    acceptedLicenseTerms,
    files,
    hasRequiredFile,
    isSoulMode,
    totalBytes,
    requiredFileLabel,
    slugCollision,
  ]);

  // webkitdirectory/directory attributes are set via the ref callback (setFileInputRef)
  // to ensure they persist across hydration and re-renders (#58)

  if (!isAuthenticated) {
    return (
      <main className="section">
        <div className="card">登录以上传 {contentLabel}。</div>
      </main>
    );
  }

  async function applyExpandedFiles(selected: File[]) {
    const report = await expandFilesWithReport(selected);
    setFiles(report.files);
    setIgnoredMacJunkPaths(report.ignoredMacJunkPaths);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setHasAttempted(true);
    if (!validation.ready) {
      if (validationRef.current && "scrollIntoView" in validationRef.current) {
        validationRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }
    if (slugCollision) {
      setError(slugCollision.message);
      return;
    }
    if (!isSoulMode && !acceptedLicenseTerms) {
      setError("Accept the MIT-0 license terms to publish this skill.");
      return;
    }
    setError(null);
    if (totalBytes > maxBytes) {
      setError("每个版本的文件总大小超过 50MB。");
      return;
    }
    if (!hasRequiredFile) {
      setError(`${requiredFileLabel} is required.`);
      return;
    }
    setStatus("上传文件中…");

    const uploaded = [] as Array<{
      path: string;
      size: number;
      storageId: string;
      sha256: string;
      contentType?: string;
    }>;

    for (const file of files) {
      const uploadUrl = await generateUploadUrl();
      const rawPath = (file.webkitRelativePath || file.name).replace(/^\.\//, "");
      const path =
        stripRoot && rawPath.startsWith(`${stripRoot}/`)
          ? rawPath.slice(stripRoot.length + 1)
          : rawPath;
      const sha256 = await hashFile(file);
      const storageId = await uploadFile(uploadUrl, file);
      uploaded.push({
        path,
        size: file.size,
        storageId,
        sha256,
        contentType: file.type || undefined,
      });
    }

    setStatus("发布中…");
    try {
      const result = await publishVersion({
        slug: trimmedSlug,
        displayName: trimmedName,
        version,
        changelog: trimmedChangelog,
        acceptLicenseTerms: isSoulMode ? undefined : acceptedLicenseTerms,
        tags: parsedTags,
        files: uploaded,
      });
      setStatus(null);
      setError(null);
      setHasAttempted(false);
      setChangelogSource("user");
      if (result) {
        const ownerParam = me?.handle ?? (me?._id ? String(me._id) : "unknown");
        void navigate({
          to: isSoulMode ? "/souls/$slug" : "/$owner/$slug",
          params: isSoulMode ? { slug: trimmedSlug } : { owner: ownerParam, slug: trimmedSlug },
        });
      }
    } catch (publishError) {
      setStatus(null);
      setError(formatPublishError(publishError));
    }
  }

  return (
    <main className="section upload-page">
      <header className="upload-page-header">
        <div>
          <h1 className="upload-page-title">发布 {contentLabel}</h1>
          <p className="upload-page-subtitle">
            拖放包含 {requiredFileLabel} 和文本文件的文件夹。我们将处理其余部分。
          </p>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="upload-grid">
        <div className="card upload-panel">
          <label className="form-label" htmlFor="slug">
            Slug
          </label>
          <input
            className="form-input"
            id="slug"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            placeholder={`${contentLabel}-name`}
          />

          <label className="form-label" htmlFor="displayName">
            Display name
          </label>
          <input
            className="form-input"
            id="displayName"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder={`My ${contentLabel}`}
          />

          <label className="form-label" htmlFor="version">
            Version
          </label>
          <input
            className="form-input"
            id="version"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
            placeholder="1.0.0"
          />

          <label className="form-label" htmlFor="tags">
            Tags
          </label>
          <input
            className="form-input"
            id="tags"
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            placeholder="latest, stable"
          />
        </div>

        <div className="card upload-panel">
          <label
            className={`upload-dropzone${isDragging ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setIsDragging(false);
              const items = event.dataTransfer.items;
              void (async () => {
                const dropped = items?.length
                  ? await expandDroppedItems(items)
                  : Array.from(event.dataTransfer.files);
                await applyExpandedFiles(dropped);
              })();
            }}
          >
            <input
              ref={setFileInputRef}
              className="upload-file-input"
              id="upload-files"
              data-testid="upload-input"
              type="file"
              multiple
              onChange={(event) => {
                const picked = Array.from(event.target.files ?? []);
                void applyExpandedFiles(picked);
              }}
            />
            <div className="upload-dropzone-copy">
              <div className="upload-dropzone-title-row">
                <strong>拖放文件夹</strong>
                <span className="upload-dropzone-count">
                  {files.length} files · {sizeLabel}
                </span>
              </div>
              <span className="upload-dropzone-hint">
                我们保留文件夹路径并自动扁平化外层包装。
              </span>
              <button
                className="btn upload-picker-btn"
                type="button"
                onClick={() => fileInputRef.current?.click()}
              >
                选择文件夹
              </button>
            </div>
          </label>

          <div className="upload-file-list">
            {files.length === 0 ? (
              <div className="stat">未选择文件。</div>
            ) : (
              normalizedPaths.map((path) => (
                <div key={path} className="upload-file-row">
                  <span>{path}</span>
                </div>
              ))
            )}
          </div>
          {ignoredMacJunkNote ? <div className="stat">{ignoredMacJunkNote}</div> : null}
        </div>

        <div className="card upload-panel" ref={validationRef}>
          <h2 className="upload-panel-title">验证</h2>
          {validation.issues.length === 0 ? (
            <div className="stat">所有检查通过。</div>
          ) : (
            <ul className="validation-list">
              {validation.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          )}
          {slugCollision?.url ? (
            <div className="stat">
              已有 skill：{" "}
              <a href={slugCollision.url} className="upload-link">
                {slugCollision.url}
              </a>
            </div>
          ) : null}
        </div>

        <div className="card upload-panel">
          {!isSoulMode ? (
            <>
              <h2 className="upload-panel-title">License</h2>
              <div className="upload-license-card">
                <div className="upload-license-pill">
                  {PLATFORM_SKILL_LICENSE} · {PLATFORM_SKILL_LICENSE_NAME}
                </div>
                <p className="upload-license-copy">
                  所有发布在 ClawHub 上的 skills 都使用 {PLATFORM_SKILL_LICENSE} license。{" "}
                  {PLATFORM_SKILL_LICENSE_SUMMARY}
                </p>
                <label className="upload-license-check">
                  <input
                    type="checkbox"
                    checked={acceptedLicenseTerms}
                    onChange={(event) => setAcceptedLicenseTerms(event.target.checked)}
                  />
                  <span>
                    I have the rights to this skill and agree to publish it under{" "}
                    {PLATFORM_SKILL_LICENSE}.
                  </span>
                </label>
              </div>
            </>
          ) : null}
          <label className="form-label" htmlFor="changelog">
            Changelog
          </label>
          <textarea
            className="form-input"
            id="changelog"
            rows={6}
            value={changelog}
            onChange={(event) => {
              changelogTouchedRef.current = true;
              setChangelogSource("user");
              setChangelog(event.target.value);
            }}
            placeholder={`Describe what changed in this ${contentLabel}...`}
          />
          {changelogStatus === "loading" ? <div className="stat">生成 changelog 中…</div> : null}
          {changelogStatus === "error" ? (
            <div className="stat">无法自动生成 changelog。</div>
          ) : null}
          {changelogSource === "auto" && changelog ? (
            <div className="stat">自动生成的 changelog（可按需编辑）。</div>
          ) : null}
        </div>

        <div className="upload-submit-row">
          <div className="upload-submit-notes">
            {error ? (
              <div className="error" role="alert">
                {error}
              </div>
            ) : null}
            {status ? <div className="stat">{status}</div> : null}
            {hasAttempted && !validation.ready ? (
              <div className="stat">修复验证问题以继续。</div>
            ) : null}
          </div>
          <button
            className="btn btn-primary upload-submit-btn"
            type="submit"
            disabled={!validation.ready || isSubmitting}
          >
            发布 {contentLabel}
          </button>
        </div>
      </form>
    </main>
  );
}
