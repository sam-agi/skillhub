import type { RefObject } from "react";
import { type SortDir, type SortKey } from "./-params";

type SkillsToolbarProps = {
  searchInputRef: RefObject<HTMLInputElement | null>;
  query: string;
  hasQuery: boolean;
  sort: SortKey;
  dir: SortDir;
  view: "cards" | "list";
  highlightedOnly: boolean;
  nonSuspiciousOnly: boolean;
  onQueryChange: (next: string) => void;
  onToggle精选: () => void;
  onToggleNonSuspicious: () => void;
  onSortChange: (value: string) => void;
  onToggleDir: () => void;
  onToggleView: () => void;
};

export function SkillsToolbar({
  searchInputRef,
  query,
  hasQuery,
  sort,
  dir,
  view,
  highlightedOnly,
  nonSuspiciousOnly,
  onQueryChange,
  onToggleHighlighted,
  onToggleNonSuspicious,
  onSortChange,
  onToggleDir,
  onToggleView,
}: SkillsToolbarProps) {
  return (
    <div class名称="skills-toolbar">
      <div className="skills-search">
        <input
          ref={searchInputRef}
          className="skills-search-input"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="按 name、slug 或 summary 筛选…"
        />
      </div>
      <div className="skills-toolbar-row">
        <button
          className={`search-filter-button${highlightedOnly ? " is-active" : ""}`}
          type="button"
          aria-pressed={highlightedOnly}
          onClick={onToggleHighlighted}
        >
          Highlighted
        </button>
        <button
          className={`search-filter-button${nonSuspiciousOnly ? " is-active" : ""}`}
          type="button"
          aria-pressed={nonSuspiciousOnly}
          onClick={onToggleNonSuspicious}
        >
          隐藏可疑
        </button>
        <select
          className="skills-sort"
          value={sort}
          onChange={(event) => onSortChange(event.target.value)}
          aria-label="排序 skills"
        >
          {hasQuery ? <option value="relevance">相关度</option> : null}
          <option value="newest">最新</option>
          <option value="updated">最近更新</option>
          <option value="downloads">下载量</option>
          <option value="installs">安装量</option>
          <option value="stars">Stars</option>
          <option value="name">Name</option>
        </select>
        <button
          className="skills-dir"
          type="button"
          aria-label={`Sort direction ${dir}`}
          onClick={onToggleDir}
        >
          {dir === "asc" ? "↑" : "↓"}
        </button>
        <button
          className={`skills-view${view === "cards" ? " is-active" : ""}`}
          type="button"
          onClick={onToggleView}
        >
          {view === "cards" ? "列表" : "卡片"}
        </button>
      </div>
    </div>
  );
}
