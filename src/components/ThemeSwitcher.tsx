import { useThemeMode, type BrandTheme, type ThemeMode } from "../lib/theme";

export function ThemeSwitcher() {
  const { mode, setMode, brand, setBrand } = useThemeMode();

  const handleModeChange = (newMode: ThemeMode) => {
    setMode(newMode);
  };

  const handleBrandChange = (newBrand: BrandTheme) => {
    setBrand(newBrand);
  };

  return (
    <div className="theme-switcher">
      <div className="theme-section">
        <span className="theme-label">主题风格</span>
        <div className="theme-options">
          <button
            className={`theme-option${brand === "bgi" ? " is-active" : ""}`}
            onClick={() => handleBrandChange("bgi")}
            title="BGI 企业蓝"
          >
            <span className="theme-preview theme-preview-bgi" />
            <span>BGI 蓝</span>
          </button>
          <button
            className={`theme-option${brand === "classic" ? " is-active" : ""}`}
            onClick={() => handleBrandChange("classic")}
            title="经典棕色"
          >
            <span className="theme-preview theme-preview-classic" />
            <span>经典棕</span>
          </button>
        </div>
      </div>

      <div className="theme-section">
        <span className="theme-label">显示模式</span>
        <div className="theme-options">
          <button
            className={`theme-option${mode === "light" ? " is-active" : ""}`}
            onClick={() => handleModeChange("light")}
          >
            ☀️ 浅色
          </button>
          <button
            className={`theme-option${mode === "dark" ? " is-active" : ""}`}
            onClick={() => handleModeChange("dark")}
          >
            🌙 深色
          </button>
          <button
            className={`theme-option${mode === "system" ? " is-active" : ""}`}
            onClick={() => handleModeChange("system")}
          >
            💻 跟随系统
          </button>
        </div>
      </div>

      <style>{`
        .theme-switcher {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        
        .theme-section {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        
        .theme-label {
          font-size: 0.875rem;
          font-weight: 500;
          color: var(--ink-soft);
        }
        
        .theme-options {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        
        .theme-option {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid var(--line);
          border-radius: var(--radius-sm);
          background: var(--surface);
          color: var(--ink);
          font-size: 0.875rem;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        
        .theme-option:hover {
          border-color: var(--border-ui-hover);
        }
        
        .theme-option.is-active {
          border-color: var(--accent);
          background: var(--accent);
          color: white;
        }
        
        [data-theme="dark"] .theme-option.is-active {
          background: linear-gradient(135deg, #00a8bd, #007a8a);
          text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
        }
        
        .theme-preview {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid var(--line);
        }
        
        .theme-preview-bgi {
          background: linear-gradient(135deg, #00cfeb 50%, #f2f3f3 50%);
        }
        
        .theme-preview-classic {
          background: linear-gradient(135deg, #e65c46 50%, #f8f2ed 50%);
        }
        
        .theme-option.is-active .theme-preview {
          border-color: rgba(255, 255, 255, 0.5);
        }
      `}</style>
    </div>
  );
}
