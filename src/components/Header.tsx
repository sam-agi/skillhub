import { useAuthActions } from "@convex-dev/auth/react";
import { Link } from "@tanstack/react-router";
import { Menu, Monitor, Moon, Sun } from "lucide-react";
import { useMemo, useRef, useState, useEffect } from "react";

import { gravatarUrl } from "../lib/gravatar";
import { isModerator } from "../lib/roles";
import { getSkillHubSiteUrl, getSiteMode, getSiteName } from "../lib/site";
import { applyTheme, useThemeMode } from "../lib/theme";
import { startThemeTransition } from "../lib/theme-transition";
import { useAuthError } from "../lib/useAuthError";
import { useAuthStatus } from "../lib/useAuthStatus";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "./ui/toggle-group";



export default function Header() {
  const { me } = useAuthStatus();
  const { signIn, signOut } = useAuthActions();
  const { mode, setMode } = useThemeMode();
  const toggleRef = useRef<HTMLDivElement | null>(null);
  const siteMode = getSiteMode();
  const siteName = useMemo(() => getSiteName(siteMode), [siteMode]);
  const isSoulMode = siteMode === "souls";
  const clawHubUrl = getSkillHubSiteUrl();

  const avatar = me?.image ?? (me?.email ? gravatarUrl(me.email) : undefined);
  const handle = me?.handle ?? me?.displayName ?? "user";
  const initial = (me?.displayName ?? me?.name ?? handle).charAt(0).toUpperCase();
  const isStaff = isModerator(me);
  const { error: authError, clear: clearAuthError } = useAuthError();
  const signInRedirectTo = getCurrentRelativeUrl();

  const setTheme = (next: "system" | "light" | "dark") => {
    startThemeTransition({
      nextTheme: next,
      currentTheme: mode,
      setTheme: (value) => {
        const nextMode = value as "system" | "light" | "dark";
        applyTheme(nextMode);
        setMode(nextMode);
      },
      context: { element: toggleRef.current },
    });
  };

  return (
    <header className="navbar">
      <div className="navbar-inner">
        <Link
          to="/"
          search={{ q: undefined, highlighted: undefined, search: undefined }}
          className="brand"
        >
          <span className="brand-mark">
            <img src="/clawd-logo.png" alt="" aria-hidden="true" />
          </span>
          <span className="brand-name">{siteName}</span>
        </Link>
        <nav className="nav-links">
          {isSoulMode ? <a href={clawHubUrl}>SkillHub</a> : null}
          {isSoulMode ? (
            <Link
              to="/souls"
              search={{
                q: undefined,
                sort: undefined,
                dir: undefined,
                view: undefined,
                focus: undefined,
              }}
            >
              Souls
            </Link>
          ) : (
            <Link
              to="/skills"
              search={{
                q: undefined,
                sort: undefined,
                dir: undefined,
                highlighted: undefined,
                nonSuspicious: undefined,
                view: undefined,
                focus: undefined,
              }}
            >
              Skills
            </Link>
          )}
          <Link to="/upload" search={{ updateSlug: undefined }}>
            上传
          </Link>
          {isSoulMode ? null : <Link to="/import">导入</Link>}
          <Link
            to={isSoulMode ? "/souls" : "/skills"}
            search={
              isSoulMode
                ? {
                    q: undefined,
                    sort: undefined,
                    dir: undefined,
                    view: undefined,
                    focus: "search",
                  }
                : {
                    q: undefined,
                    sort: undefined,
                    dir: undefined,
                    highlighted: undefined,
                    nonSuspicious: undefined,
                    view: undefined,
                    focus: "search",
                  }
            }
          >
            搜索
          </Link>
          {me ? <Link to="/stars">收藏</Link> : null}
          {isStaff ? (
            <Link to="/management" search={{ skill: undefined }}>
              管理
            </Link>
          ) : null}
        </nav>
        <div className="nav-actions">
          <div className="nav-mobile">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="nav-mobile-trigger" type="button" aria-label="Open menu">
                  <Menu className="h-4 w-4" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {isSoulMode ? (
                  <DropdownMenuItem asChild>
                    <a href={clawHubUrl}>SkillHub</a>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem asChild>
                  {isSoulMode ? (
                    <Link
                      to="/souls"
                      search={{
                        q: undefined,
                        sort: undefined,
                        dir: undefined,
                        view: undefined,
                        focus: undefined,
                      }}
                    >
                      Souls
                    </Link>
                  ) : (
                    <Link
                      to="/skills"
                      search={{
                        q: undefined,
                        sort: undefined,
                        dir: undefined,
                        highlighted: undefined,
                        nonSuspicious: undefined,
                        view: undefined,
                        focus: undefined,
                      }}
                    >
                      Skills
                    </Link>
                  )}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/upload" search={{ updateSlug: undefined }}>
                    Upload
                  </Link>
                </DropdownMenuItem>
                {isSoulMode ? null : (
                  <DropdownMenuItem asChild>
                    <Link to="/import">Import</Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    to={isSoulMode ? "/souls" : "/skills"}
                    search={
                      isSoulMode
                        ? {
                            q: undefined,
                            sort: undefined,
                            dir: undefined,
                            view: undefined,
                            focus: "search",
                          }
                        : {
                            q: undefined,
                            sort: undefined,
                            dir: undefined,
                            highlighted: undefined,
                            nonSuspicious: undefined,
                            view: undefined,
                            focus: "search",
                          }
                    }
                  >
                    Search
                  </Link>
                </DropdownMenuItem>
                {me ? (
                  <DropdownMenuItem asChild>
                    <Link to="/stars">Stars</Link>
                  </DropdownMenuItem>
                ) : null}
                {isStaff ? (
                  <DropdownMenuItem asChild>
                    <Link to="/management" search={{ skill: undefined }}>
                      Management
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  <Monitor className="h-4 w-4" aria-hidden="true" />
                  跟随系统
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  <Sun className="h-4 w-4" aria-hidden="true" />
                  浅色
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  <Moon className="h-4 w-4" aria-hidden="true" />
                  深色
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <div className="theme-toggle" ref={toggleRef}>
            <ToggleGroup
              type="single"
              value={mode}
              onValueChange={(value) => {
                if (!value) return;
                setTheme(value as "system" | "light" | "dark");
              }}
              aria-label="Theme mode"
            >
              <ToggleGroupItem value="system" aria-label="System theme">
                <Monitor className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">跟随系统</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="light" aria-label="Light theme">
                <Sun className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">浅色</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="dark" aria-label="Dark theme">
                <Moon className="h-4 w-4" aria-hidden="true" />
                <span className="sr-only">深色</span>
              </ToggleGroupItem>
            </ToggleGroup>
          </div>
          <ClientLoginButton />
        </div>
      </div>
    </header>
  );
}

function getCurrentRelativeUrl() {
  if (typeof window === "undefined") return "/";
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

// 客户端登录按钮组件
function ClientLoginButton() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<{ username: string; avatarUrl?: string } | null>(null);

  useEffect(() => {
    // 检查登录状态
    import("../lib/flarumAuth").then(({ getCurrentUser, isAuthenticated }) => {
      if (isAuthenticated()) {
        getCurrentUser().then((u) => {
          if (u) {
            setUser(u);
            setIsLoggedIn(true);
          }
        });
      }
    });
  }, []);

  const handleLogout = async () => {
    const { logout } = await import("../lib/flarumAuth");
    await logout();
    setIsLoggedIn(false);
    setUser(null);
    window.location.reload();
  };

  if (isLoggedIn && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="user-trigger" type="button">
            <img 
              src={user.avatarUrl || "/default-avatar.png"} 
              alt={user.username}
              style={{ width: 32, height: 32, borderRadius: "50%", marginRight: 8, objectFit: "cover", objectPosition: "center" }}
            />
            <span className="mono">@{user.username}</span>
            <span className="user-menu-chevron">▾</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link to="/dashboard">仪表板</Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link to="/settings">设置</Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleLogout}>退出登录</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Link to="/login" className="btn btn-primary">
      登录
    </Link>
  );
}
