import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "通靈少根筋";

const STALE_SHELL_RECOVERY = `(function(){var k='psi-stale';function bump(){try{if(sessionStorage.getItem(k))return;sessionStorage.setItem(k,'1')}catch(e){return}location.reload()}addEventListener('pageshow',function(e){if(e.persisted)location.reload()});addEventListener('error',function(e){var t=e.target;if(t&&t.tagName==='SCRIPT')bump()},true);setTimeout(function(){if(!document.documentElement.getAttribute('data-hydrated'))bump()},3500)})();`;

function MarkHydrated() {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "1";
    try {
      sessionStorage.removeItem("psi-stale");
    } catch {
      /* ignore */
    }
  }, []);
  return null;
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: APP_NAME },
      { name: "theme-color", content: "#b13222" },
      {
        name: "description",
        content: "朋友聚會時一本正經地胡說八道。光譜問事派對遊戲。",
      },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@600;700&display=swap",
      },
    ],
    scripts: [{ children: STALE_SHELL_RECOVERY }],
  }),
  component: () => (
    <html lang="zh-Hant" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="paper-grid min-h-dvh">
        <MarkHydrated />
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <Toaster
          position="top-center"
          theme="light"
          toastOptions={{
            className: "!bg-surface !text-ink !border-border !font-sans",
          }}
        />
        <Scripts />
      </body>
    </html>
  ),
});
