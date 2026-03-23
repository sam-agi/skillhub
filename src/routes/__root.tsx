import { TanStackDevtools } from "@tanstack/react-devtools";
import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { Analytics } from "@vercel/analytics/react";
import { AppProviders } from "../components/AppProviders";
import { ClientOnly } from "../components/ClientOnly";
import { DeploymentDriftBanner } from "../components/DeploymentDriftBanner";
import { Footer } from "../components/Footer";
import Header from "../components/Header";
import { isDevRuntime } from "../lib/runtimeEnv";
import { getSiteDescription, getSiteMode, getSiteName, getSiteUrlForMode } from "../lib/site";
import appCss from "../styles.css?url";

export const Route = createRootRoute({
  head: () => {
    const mode = getSiteMode();
    const siteName = getSiteName(mode);
    const siteDescription = getSiteDescription(mode);
    const siteUrl = getSiteUrlForMode(mode);
    const ogImage = `${siteUrl}/og.png`;

    return {
      meta: [
        {
          charSet: "utf-8",
        },
        {
          name: "viewport",
          content: "width=device-width, initial-scale=1",
        },
        {
          title: siteName,
        },
        {
          name: "description",
          content: siteDescription,
        },
        {
          property: "og:site_name",
          content: siteName,
        },
        {
          property: "og:type",
          content: "website",
        },
        {
          property: "og:title",
          content: siteName,
        },
        {
          property: "og:description",
          content: siteDescription,
        },
        {
          property: "og:image",
          content: ogImage,
        },
        {
          property: "og:image:width",
          content: "1200",
        },
        {
          property: "og:image:height",
          content: "630",
        },
        {
          property: "og:image:alt",
          content: `${siteName} — ${siteDescription}`,
        },
        {
          name: "twitter:card",
          content: "summary_large_image",
        },
        {
          name: "twitter:title",
          content: siteName,
        },
        {
          name: "twitter:description",
          content: siteDescription,
        },
        {
          name: "twitter:image",
          content: ogImage,
        },
        {
          name: "twitter:image:alt",
          content: `${siteName} — ${siteDescription}`,
        },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        {
          rel: "icon",
          type: "image/png",
          href: "/favicon.png",
        },
        {
          rel: "apple-touch-icon",
          href: "/logo192.png",
        },
        {
          rel: "manifest",
          href: "/manifest.json",
        },
      ],
    };
  },

  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
  // 内联主题检测脚本 - 在页面渲染前执行，防止主题闪烁
  const themeScript = `
    (function() {
      const THEME_KEY = "skillhub-theme";
      const BRAND_KEY = "clawhub-brand";
      const LEGACY_THEME_KEY = "clawdhub-theme";
      function getStoredTheme() {
        const stored = localStorage.getItem(THEME_KEY);
        if (stored === "light" || stored === "dark" || stored === "system") return stored;
        const legacy = localStorage.getItem(LEGACY_THEME_KEY);
        if (legacy === "light" || legacy === "dark" || legacy === "system") return legacy;
        return "system";
      }
      function getStoredBrand() {
        const stored = localStorage.getItem(BRAND_KEY);
        if (stored === "classic" || stored === "bgi") return stored;
        return "bgi";
      }
      function resolveTheme(mode) {
        if (mode !== "system") return mode;
        return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
      }
      const mode = getStoredTheme();
      const brand = getStoredBrand();
      const resolved = resolveTheme(mode);
      document.documentElement.dataset.theme = resolved;
      document.documentElement.dataset.brand = brand;
      if (resolved === "dark") document.documentElement.classList.add("dark");
    })();
  `;

  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <AppProviders>
          <div className="app-shell">
            <Header />
            <ClientOnly>
              <DeploymentDriftBanner />
            </ClientOnly>
            {children}
            <Footer />
          </div>
          <ClientOnly>
            <Analytics />
            {isDevRuntime() ? (
              <TanStackDevtools
                config={{
                  position: "bottom-right",
                }}
                plugins={[
                  {
                    name: "Tanstack Router",
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                ]}
              />
            ) : null}
          </ClientOnly>
        </AppProviders>
        <Scripts />
      </body>
    </html>
  );
}
