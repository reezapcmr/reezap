import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/reezap";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/notifications")({
  head: () => ({
    meta: [
      { title: "Notifications — Reezap" },
      {
        name: "description",
        content: "New posts from vendors you follow, plus updates about your own listings.",
      },
      { property: "og:title", content: "Notifications — Reezap" },
      {
        property: "og:description",
        content: "Stay on top of what your favourite vendors just posted.",
      },
    ],
  }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/notifications" } });
  }, [loading, user, navigate]);

  const { data: items } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,kind,title,body,listing_id,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user || !items?.some((i) => !i.is_read)) return;
    void supabase.from("notifications").update({ is_read: true }).eq("user_id", user.id).eq("is_read", false);
  }, [user, items]);

  return (
    <AppShell>
      <TopBar title="Notifications" />
      {!items?.length && (
        <div className="px-6 py-20 text-center">
          <Bell className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 font-semibold">Nothing yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Follow vendors and you'll hear when they post something new.
          </p>
        </div>
      )}
      <ul className="divide-y divide-border">
        {items?.map((n) => {
          const body = (
            <div className={cn("px-4 py-4", !n.is_read && "bg-surface")}>
              <p className="text-sm font-semibold">{n.title}</p>
              {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
            </div>
          );
          return (
            <li key={n.id}>
              {n.listing_id ? (
                <Link to="/listing/$id" params={{ id: n.listing_id }}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </li>
          );
        })}
      </ul>
    </AppShell>
  );
}
