import { Link, useRouterState } from "@tanstack/react-router";
import { Bell, Home, Plus, Search, User, ShieldCheck, Bookmark, Settings } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/logo";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";

const tabs = [
  { to: "/", label: "Home", icon: Home },
  { to: "/search", label: "Search", icon: Search },
  { to: "/post", label: "Post", icon: Plus },
  { to: "/notifications", label: "Alerts", icon: Bell },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function useUnreadCount() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("is_read", false);
      return count ?? 0;
    },
  });
}

export function AppShell({ children }: { children: ReactNode }) {
  const path = useRouterState({ select: (s) => s.location.pathname });
  const { isAdmin } = useAuth();
  const { data: unread } = useUnreadCount();

  const sideLinks = [
    ...tabs.filter((t) => t.to !== "/post"),
    { to: "/saved", label: "Saved", icon: Bookmark } as const,
    { to: "/settings", label: "Settings", icon: Settings } as const,
    ...(isAdmin ? [{ to: "/admin", label: "Admin", icon: ShieldCheck } as const] : []),
  ];

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-border bg-sidebar px-4 py-6 lg:flex">
        <Logo />
        <nav className="mt-8 flex flex-col gap-1">
          {sideLinks.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground",
                path === to && "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              <Icon className="size-[18px]" />
              {label}
              {to === "/notifications" && !!unread && (
                <span className="ml-auto rounded-full bg-primary px-1.5 text-[11px] font-bold text-primary-foreground">
                  {unread}
                </span>
              )}
            </Link>
          ))}
        </nav>
        <Link
          to="/post"
          className="mt-6 flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90"
        >
          <Plus className="size-4" /> Post something
        </Link>
      </aside>

      <div className="lg:pl-60">
        <main className="mx-auto w-full max-w-2xl pb-28 lg:pb-12">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-2xl items-center justify-around px-2 py-2">
          {tabs.map(({ to, label, icon: Icon }) => {
            const active = path === to;
            if (to === "/post") {
              return (
                <Link
                  key={to}
                  to={to}
                  aria-label="Post a listing"
                  className="-mt-6 flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-glow"
                >
                  <Plus className="size-6" />
                </Link>
              );
            }
            return (
              <Link
                key={to}
                to={to}
                aria-label={label}
                className={cn(
                  "relative flex flex-1 flex-col items-center gap-1 py-1 text-[11px] font-medium text-muted-foreground",
                  active && "text-primary",
                )}
              >
                <Icon className="size-5" />
                {label}
                {to === "/notifications" && !!unread && (
                  <span className="absolute right-[22%] top-0 size-2 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

export function TopBar({ title, right }: { title?: ReactNode; right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur lg:px-6">
      {title ? (
        <h1 className="text-lg font-bold">{title}</h1>
      ) : (
        <div className="lg:hidden">
          <Logo size={28} />
        </div>
      )}
      {right}
    </header>
  );
}
