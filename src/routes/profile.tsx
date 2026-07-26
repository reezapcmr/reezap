import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { BadgeCheck, Eye, MessageCircle, Settings, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { Avatar, ListingMedia, StatusPill } from "@/components/listing-card";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { formatPrice, isFresh } from "@/lib/reezap";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "Your Reezap profile" },
      {
        name: "description",
        content: "Manage your listings, track views and WhatsApp orders, and grow your following.",
      },
      { property: "og:title", content: "Your Reezap profile" },
      {
        property: "og:description",
        content: "Your vendor dashboard on Reezap: listings, views and WhatsApp orders.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, profile, loading, isAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/profile" } });
  }, [loading, user, navigate]);

  const { data: listings } = useQuery({
    queryKey: ["my-listings", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id,title,price,media_url,status,created_at,view_count,whatsapp_click_count")
        .eq("vendor_id", user!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: followers } = useQuery({
    queryKey: ["my-followers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { count } = await supabase
        .from("follows")
        .select("follower_id", { count: "exact", head: true })
        .eq("vendor_id", user!.id);
      return count ?? 0;
    },
  });

  async function toggleStatus(id: string, status: string) {
    await supabase
      .from("listings")
      .update({ status: status === "in_stock" ? "sold_out_today" : "in_stock" })
      .eq("id", id);
    window.location.reload();
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted-foreground">Loading your profile…</div>
      </AppShell>
    );
  }

  const views = listings?.reduce((s, l) => s + (l.view_count ?? 0), 0) ?? 0;
  const orders = listings?.reduce((s, l) => s + (l.whatsapp_click_count ?? 0), 0) ?? 0;

  return (
    <AppShell>
      <TopBar
        title="Profile"
        right={
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Link to="/admin" aria-label="Admin" className="rounded-full p-2 hover:bg-secondary">
                <ShieldCheck className="size-5" />
              </Link>
            )}
            <Link
              to="/settings"
              aria-label="Settings"
              className="rounded-full p-2 hover:bg-secondary"
            >
              <Settings className="size-5" />
            </Link>
          </div>
        }
      />

      <section className="border-b border-border p-4">
        <div className="flex items-center gap-4">
          <Avatar profile={profile} size={68} />
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-lg font-extrabold">
              <span className="truncate">{profile.display_name ?? profile.username}</span>
              {profile.is_verified && <BadgeCheck className="size-5 text-primary" />}
            </h2>
            <p className="text-sm text-muted-foreground">@{profile.username}</p>
          </div>
        </div>
        {profile.bio && <p className="mt-3 text-sm text-foreground/90">{profile.bio}</p>}
        <Link to="/settings">
          <Button variant="secondary" className="mt-4 w-full rounded-full font-bold">
            Edit profile
          </Button>
        </Link>
      </section>

      {profile.is_vendor ? (
        <>
          <section className="grid grid-cols-3 divide-x divide-border border-b border-border">
            {[
              { label: "Views", value: views, icon: Eye },
              { label: "WhatsApp orders", value: orders, icon: MessageCircle },
              { label: "Followers", value: followers ?? 0, icon: BadgeCheck },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="px-3 py-4 text-center">
                <Icon className="mx-auto size-4 text-primary" />
                <p className="mt-1 text-lg font-extrabold">{value}</p>
                <p className="text-[11px] text-muted-foreground">{label}</p>
              </div>
            ))}
          </section>

          {!profile.is_verified && (
            <Link
              to="/settings"
              className="block border-b border-border bg-surface px-4 py-3 text-sm"
            >
              <span className="font-semibold text-primary">Get verified</span>
              <span className="ml-1 text-muted-foreground">
                — submit your ID for a trust badge on your profile.
              </span>
            </Link>
          )}

          <section className="divide-y divide-border">
            {listings?.map((l) => (
              <div key={l.id} className="flex items-center gap-3 p-3">
                <Link
                  to="/listing/$id"
                  params={{ id: l.id }}
                  className="size-16 shrink-0 overflow-hidden rounded-lg"
                >
                  <ListingMedia path={l.media_url} alt={l.title} />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{l.title}</p>
                  <p className="text-xs text-primary">{formatPrice(l.price)}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {l.view_count ?? 0} views · {l.whatsapp_click_count ?? 0} orders
                  </p>
                </div>
                <button onClick={() => toggleStatus(l.id, l.status)}>
                  <StatusPill status={l.status} fresh={isFresh(l.created_at)} />
                </button>
              </div>
            ))}
          </section>
        </>
      ) : (
        <div className="px-6 py-14 text-center">
          <p className="font-semibold">You haven't posted yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Post your first listing and your vendor dashboard unlocks automatically.
          </p>
          <Link
            to="/post"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Post something
          </Link>
        </div>
      )}
    </AppShell>
  );
}
