export type SiteMode = "skills" | "souls";

import { getRuntimeEnv } from "./runtimeEnv";

const DEFAULT_SKILLHUB_SITE_URL = "https://skillhub.ai";
const DEFAULT_ONLYCRABS_SITE_URL = "https://onlycrabs.ai";
const DEFAULT_ONLYCRABS_HOST = "onlycrabs.ai";
const LEGACY_CLAWDHUB_HOSTS = new Set(["clawdhub.com", "www.clawdhub.com", "auth.clawdhub.com"]);

export function normalizeSkillHubSiteOrigin(value?: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (LEGACY_CLAWDHUB_HOSTS.has(url.hostname.toLowerCase())) {
      return DEFAULT_SKILLHUB_SITE_URL;
    }
    return url.origin;
  } catch {
    return null;
  }
}

export function getSkillHubSiteUrl() {
  return normalizeSkillHubSiteOrigin(getRuntimeEnv("VITE_SITE_URL")) ?? DEFAULT_SKILLHUB_SITE_URL;
}

export function getOnlyCrabsSiteUrl() {
  const explicit = getRuntimeEnv("VITE_SOULHUB_SITE_URL");
  if (explicit) return explicit;

  const siteUrl = getRuntimeEnv("VITE_SITE_URL");
  if (siteUrl) {
    try {
      const url = new URL(siteUrl);
      if (
        url.hostname === "localhost" ||
        url.hostname === "127.0.0.1" ||
        url.hostname === "0.0.0.0"
      ) {
        return url.origin;
      }
    } catch {
      // ignore invalid URLs, fall through to default
    }
  }

  return DEFAULT_ONLYCRABS_SITE_URL;
}

export function getOnlyCrabsHost() {
  return getRuntimeEnv("VITE_SOULHUB_HOST") ?? DEFAULT_ONLYCRABS_HOST;
}

export function detectSiteMode(host?: string | null): SiteMode {
  if (!host) return "skills";
  const onlyCrabsHost = getOnlyCrabsHost().toLowerCase();
  const lower = host.toLowerCase();
  if (lower === onlyCrabsHost || lower.endsWith(`.${onlyCrabsHost}`)) return "souls";
  return "skills";
}

export function detectSiteModeFromUrl(value?: string | null): SiteMode {
  if (!value) return "skills";
  try {
    const host = new URL(value).hostname;
    return detectSiteMode(host);
  } catch {
    return detectSiteMode(value);
  }
}

export function getSiteMode(): SiteMode {
  if (typeof window !== "undefined") {
    return detectSiteMode(window.location.hostname);
  }
  const forced = getRuntimeEnv("VITE_SITE_MODE");
  if (forced === "souls" || forced === "skills") return forced;

  const onlyCrabsSite = getRuntimeEnv("VITE_SOULHUB_SITE_URL");
  if (onlyCrabsSite) return detectSiteModeFromUrl(onlyCrabsSite);

  const siteUrl = getRuntimeEnv("VITE_SITE_URL") ?? process.env.SITE_URL;
  if (siteUrl) return detectSiteModeFromUrl(siteUrl);

  return "skills";
}

export function getSiteName(mode: SiteMode = getSiteMode()) {
  return mode === "souls" ? "SoulHub" : "SkillHub";
}

export function getSiteDescription(mode: SiteMode = getSiteMode()) {
  return mode === "souls"
    ? "SoulHub — SOUL.md skill 包和个人系统传说的家园。"
    : "SkillHub — 为 Agent 打造的快速技能注册中心，支持向量搜索。";
}

export function getSiteUrlForMode(mode: SiteMode = getSiteMode()) {
  return mode === "souls" ? getOnlyCrabsSiteUrl() : getSkillHubSiteUrl();
}
