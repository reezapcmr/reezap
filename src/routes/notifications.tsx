import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bell, CheckCheck, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { timeAgo } from "@/lib/reezap";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

type Notif = {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  listing_id: string | null;
  actor_id: string | null;
  is_read: boolean;
  created_at: string;
};

function NotificationsPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/notifications" } });
  }, [loading, user, navigate]);

  const { data: items } = useQuery({
    queryKey: ["notifications", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("notifications")
        .select("id,kind,title,body,listing_id,actor_id,is_read,created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data ?? []) as Notif[];
    },
  });

  // Usernames for actor-based notifications, so opening one lands on their profile.
  const actorIds = [...new Set((items ?? []).map((i) => i.actor_id).filter(Boolean))] as string[];
  const { data: actors } = useQuery({
    queryKey: ["notif-actors", actorIds.join(",")],
    enabled: actorIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", actorIds);
      return Object.fromEntries((data ?? []).map((p) => [p.id, p.username])) as Record<
        string,
        string
      >;
    },
  });

  const unread = items?.filter((i) => !i.is_read).length ?? 0;

  function refresh() {
    void qc.invalidateQueries({ queryKey: ["notifications", user?.id] });
    void qc.invalidateQueries({ queryKey: ["unread-notifications"] });
  }

  async function open(n: Notif) {
    if (!n.is_read) {
      await supabase.from("notifications").update({ is_read: true }).eq("id", n.id);
      refresh();
    }
    if (n.listing_id) {
      void navigate({ to: "/listing/$id", params: { id: n.listing_id } });
      return;
    }
    const username = n.actor_id ? actors?.[n.actor_id] : undefined;
    if (username) void navigate({ to: "/u/$username", params: { username } });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (error) toast.error("Could not delete this notification");
    else refresh();
  }

  async function markAllRead() {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", user.id)
      .eq("is_read", false);
    refresh();
  }

  return (
    <AppShell>
      <TopBar
        title="Notifications"
        right={
          unread > 0 ? (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-primary hover:bg-secondary"
            >
              <CheckCheck className="size-4" /> Mark all read
            </button>
          ) : undefined
        }
      />
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
        {items?.map((n) => (
          <li key={n.id} className={cn("flex items-start gap-2", !n.is_read && "bg-surface")}>
            <button onClick={() => open(n)} className="min-w-0 flex-1 px-4 py-4 text-left">
              <p className="flex items-center gap-2 text-sm font-semibold">
                {!n.is_read && <span className="size-2 shrink-0 rounded-full bg-primary" />}
                <span className="truncate">{n.title}</span>
              </p>
              {n.body && <p className="mt-0.5 text-sm text-muted-foreground">{n.body}</p>}
              <p className="mt-1 text-xs text-muted-foreground">{timeAgo(n.created_at)}</p>
            </button>
            <button
              onClick={() => remove(n.id)}
              aria-label="Delete notification"
              className="mr-3 mt-4 rounded-full p-2 text-muted-foreground hover:bg-secondary"
            >
              <Trash2 className="size-4" />
            </button>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
