import { useEffect } from "react";
import { createRootRoute, HeadContent, Outlet, Scripts } from "@tanstack/react-router";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { Toaster } from "sonner";
import appCss from "../styles.css?url";

const APP_NAME = "通靈少根筋";

function PwaBoot() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const ios =
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

    let cancelled = false;
    const boot = async () => {
      const regs = await navigator.serviceWorker.getRegistrations();
      const controlled = Boolean(navigator.serviceWorker.controller);
      await Promise.all(regs.map((r) => r.unregister()));
      if (cancelled) return;
      if (controlled) {
        try {
          if (!sessionStorage.getItem("psi-sw-reset")) {
            sessionStorage.setItem("psi-sw-reset", "1");
            window.location.reload();
            return;
          }
        } catch {
          /* private mode */
        }
      }
      if (ios) return;
      window.setTimeout(() => {
        if (!cancelled) void navigator.serviceWorker.register("/sw.js");
      }, 4000);
    };
    void boot();
    return () => {
      cancelled = true;
    };
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
      { name: "apple-mobile-web-app-title", content: APP_NAME },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "mobile-web-app-capable", content: "yes" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "icon", type: "image/png", href: "/icon-192.png" },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-180.png" },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@400;500;600;700&family=Noto+Serif+TC:wght@600;700&display=swap",
      },
    ],
  }),
  component: () => (
    <html lang="zh-Hant" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="paper-grid min-h-dvh">
        <PwaBoot />
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
