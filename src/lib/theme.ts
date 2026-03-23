import { useEffect, useState } from "react";

export type ThemeMode = "system" | "light" | "dark";
export type BrandTheme = "classic" | "bgi";

const THEME_KEY = "skillhub-theme";
const BRAND_KEY = "skillhub-brand";
const LEGACY_THEME_KEY = "clawdhub-theme";

export function getStoredTheme(): ThemeMode {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark" || stored === "system") return stored;
  const legacy = window.localStorage.getItem(LEGACY_THEME_KEY);
  if (legacy === "light" || legacy === "dark" || legacy === "system") return legacy;
  return "system";
}

export function getStoredBrand(): BrandTheme {
  if (typeof window === "undefined") return "bgi";
  const stored = window.localStorage.getItem(BRAND_KEY);
  if (stored === "classic" || stored === "bgi") return stored;
  return "bgi";
}

function resolveTheme(mode: ThemeMode) {
  if (mode !== "system") return mode;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(mode: ThemeMode, brand: BrandTheme = "bgi") {
  if (typeof document === "undefined") return;
  const resolved = resolveTheme(mode);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.brand = brand;
  document.documentElement.classList.toggle("dark", resolved === "dark");
}

export function useThemeMode() {
  const [mode, setMode] = useState<ThemeMode>("system");
  const [brand, setBrand] = useState<BrandTheme>("bgi");
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setMode(getStoredTheme());
    setBrand(getStoredBrand());
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    applyTheme(mode, brand);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(THEME_KEY, mode);
      window.localStorage.setItem(BRAND_KEY, brand);
    }
    if (mode !== "system" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(mode, brand);
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [isHydrated, mode, brand]);

  return { mode, setMode, brand, setBrand };
}
