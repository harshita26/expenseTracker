import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, createRootRouteWithContext, useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { Toaster } from "@/components/ui/sonner";
import { seedDemoIfNeeded } from "@/lib/seed";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">This page doesn't exist.</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">Go home</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          >Try again</button>
          <a href="/" className="rounded-md border border-input bg-background px-4 py-2 text-sm">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "My Money — Private Personal Finance Dashboard" },
      { name: "description", content: "Local-first personal finance dashboard. Track salary, expenses, savings, cashback and interest." },
      { name: "theme-color", content: "#0c0f1a" },
      { property: "og:title", content: "My Money — Private Personal Finance Dashboard" },
      { property: "og:description", content: "Local-first personal finance dashboard. Track salary, expenses, savings, cashback and interest." },
      { property: "og:type", content: "website" },
      { name: "twitter:title", content: "My Money — Private Personal Finance Dashboard" },
      { name: "twitter:description", content: "Local-first personal finance dashboard. Track salary, expenses, savings, cashback and interest." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9e0be77b-a52f-47f2-9181-7abdd9815432/id-preview-7c5999a6--06a0d294-4b96-47ed-bda9-83e7c35b2599.lovable.app-1782118724361.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/9e0be77b-a52f-47f2-9181-7abdd9815432/id-preview-7c5999a6--06a0d294-4b96-47ed-bda9-83e7c35b2599.lovable.app-1782118724361.png" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&display=swap" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <head><HeadContent /></head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    seedDemoIfNeeded().catch(console.error);
  }, []);
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-sm text-muted-foreground">Loading your private finance dashboard…</div>
      </div>
    );
  }
  return (
    <QueryClientProvider client={queryClient}>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset className="flex min-h-screen flex-col">
          <Outlet />
        </SidebarInset>
        <Toaster richColors theme="dark" position="top-right" />
      </SidebarProvider>
    </QueryClientProvider>
  );
}
