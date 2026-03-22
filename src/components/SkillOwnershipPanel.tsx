import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { buildSkillHref } from "./skillDetailUtils";

type OwnedSkillOption = {
  _id: Id<"skills">;
  slug: string;
  displayName: string;
};

type SkillOwnershipPanelProps = {
  skillId: Id<"skills">;
  slug: string;
  ownerHandle: string | null;
  ownerId: Id<"users"> | null;
  ownedSkills: OwnedSkillOption[];
};

function formatMutationError(error: unknown) {
  if (error instanceof Error) {
    return error.message
      .replace(/\[CONVEX[^\]]*\]\s*/g, "")
      .replace(/\[Request ID:[^\]]*\]\s*/g, "")
      .replace(/^Server Error Called by client\s*/i, "")
      .replace(/^ConvexError:\s*/i, "")
      .trim();
  }
  return "请求失败。";
}

export function SkillOwnershipPanel({
  skillId,
  slug,
  ownerHandle,
  ownerId,
  ownedSkills,
}: SkillOwnershipPanelProps) {
  const navigate = useNavigate();
  const renameOwnedSkill = useMutation(api.skills.renameOwnedSkill);
  const mergeOwnedSkillIntoCanonical = useMutation(api.skills.mergeOwnedSkillIntoCanonical);

  const [renameSlug, setRenameSlug] = useState(slug);
  const [mergeTargetSlug, setMergeTargetSlug] = useState(ownedSkills[0]?.slug ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ownerHref = (nextSlug: string) => buildSkillHref(ownerHandle, ownerId, nextSlug);

  const handleRename = async () => {
    const nextSlug = renameSlug.trim().toLowerCase();
    if (!nextSlug || nextSlug === slug) return;
    if (!window.confirm(`将 ${slug} 重命名为 ${nextSlug}？旧 slug 将 redirect。`)) return;
    setIsSubmitting(true);
    setError(null);
    try {
      await renameOwnedSkill({ slug, newSlug: nextSlug });
      await navigate({
        to: "/$owner/$slug",
        params: {
          owner: ownerHandle ?? String(ownerId ?? ""),
          slug: nextSlug,
        },
        replace: true,
      });
    } catch (renameError) {
      setError(formatMutationError(renameError));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMerge = async () => {
    const targetSlug = mergeTargetSlug.trim().toLowerCase();
    if (!targetSlug || targetSlug === slug) return;
    if (
      !window.confirm(
        `将 ${slug} 合并到 ${targetSlug}？${slug} 将停止公开列出并 redirect。`,
      )
    ) {
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await mergeOwnedSkillIntoCanonical({
        sourceSlug: slug,
        targetSlug,
      });
      await navigate({
        to: "/$owner/$slug",
        params: {
          owner: ownerHandle ?? String(ownerId ?? ""),
          slug: targetSlug,
        },
        replace: true,
      });
    } catch (mergeError) {
      setError(formatMutationError(mergeError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card skill-owner-tools" data-skill-id={skillId}>
      <h2 className="section-title" style={{ marginTop: 0 }}>
        所有者工具
      </h2>
      <p className="section-subtitle">
        重命名 canonical slug 或将此列表合并到您拥有的另一个列表中。旧 slug 将保持为
        redirect 并停止污染搜索/列表视图。
      </p>

      <div className="skill-owner-tools-grid">
        <label className="management-control management-control-stack">
          <span className="mono">重命名 slug</span>
          <input
            className="management-field"
            value={renameSlug}
            onChange={(event) => setRenameSlug(event.target.value)}
            placeholder="新 slug"
            autoComplete="off"
            spellCheck={false}
          />
          <span className="section-subtitle">当前页面：{ownerHref(slug)}</span>
        </label>
        <div className="management-control management-control-stack">
          <span className="mono">重命名操作</span>
          <button
            className="btn management-action-btn"
            type="button"
            onClick={() => void handleRename()}
            disabled={isSubmitting || renameSlug.trim().toLowerCase() === slug}
          >
            重命名并 redirect
          </button>
        </div>
        <label className="management-control management-control-stack">
          <span className="mono">合并到</span>
          <select
            className="management-field"
            value={mergeTargetSlug}
            onChange={(event) => setMergeTargetSlug(event.target.value)}
            disabled={ownedSkills.length === 0 || isSubmitting}
          >
            {ownedSkills.length === 0 ? <option value="">没有其他拥有的 skills</option> : null}
            {ownedSkills.map((entry) => (
              <option key={entry._id} value={entry.slug}>
                {entry.displayName} ({entry.slug})
              </option>
            ))}
          </select>
        </label>
        <div className="management-control management-control-stack">
          <span className="mono">合并操作</span>
          <button
            className="btn management-action-btn"
            type="button"
            onClick={() => void handleMerge()}
            disabled={isSubmitting || !mergeTargetSlug}
          >
            合并到目标
          </button>
        </div>
      </div>

      {error ? (
        <div className="stat" style={{ color: "var(--danger)" }}>
          {error}
        </div>
      ) : null}
      <div className="section-subtitle">
        合并保持目标处于活动状态并隐藏此行。版本和统计数据暂时保留在原始记录中。
      </div>
    </div>
  );
}
