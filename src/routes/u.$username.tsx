import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Avatar, ListingMedia, StatusPill } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice, isFresh, whatsappLink } from "@/lib/reezap";
import { cn } from "@/lib/utils";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/u/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `@${params.username} on Reezap` },
      {
        name: "description",
        content: `See what @${params.username} is selling on Reezap and order directly on WhatsApp.`,
      },
      { property: "og:title", content: `@${params.username} on Reezap` },
      {
        property: "og:description",
        content: `Listings, ratings and location for @${params.username} on Reezap.`,
      },
    ],
  }),
  component: VendorProfile,
});

function VendorProfile() {
  const { username } = Route.useParams();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");

  const { data: vendor } = useQuery({
    queryKey: ["vendor", username],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select(
          "id,username,display_name,avatar_url,bio,is_vendor,is_verified,created_at,towns(name,division),neighborhoods(name)",
        )
        .eq("username", username)
        .maybeSingle();
      return data;
    },
  });

  const { data: listings } = useQuery({
    queryKey: ["vendor-listings", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id,title,price,media_url,status,created_at")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: ratings } = useQuery({
    queryKey: ["ratings", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ratings")
        .select("id,stars,comment,created_at,profiles!ratings_author_id_fkey(username,display_name,avatar_url)")
        .eq("vendor_id", vendor!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const { data: followState } = useQuery({
    queryKey: ["follow", vendor?.id, user?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const [{ count }, { data: mine }] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("vendor_id", vendor!.id),
        user
          ? supabase
              .from("follows")
              .select("follower_id")
              .eq("vendor_id", vendor!.id)
              .eq("follower_id", user.id)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);
      return { count: count ?? 0, following: !!mine };
    },
  });

  async function toggleFollow() {
    if (!user || !vendor) {
      toast("Sign in to follow vendors");
      return;
    }
    if (followState?.following) {
      await supabase
        .from("follows")
        .delete()
        .eq("vendor_id", vendor.id)
        .eq("follower_id", user.id);
    } else {
      await supabase.from("follows").insert({ vendor_id: vendor.id, follower_id: user.id });
    }
    void qc.invalidateQueries({ queryKey: ["follow", vendor.id, user.id] });
  }

  async function submitRating() {
    if (!user || !vendor) {
      toast("Sign in to leave a rating");
      return;
    }
    if (!stars) return;
    const { error } = await supabase
      .from("ratings")
      .upsert(
        { vendor_id: vendor.id, author_id: user.id, stars, comment: comment || null },
        { onConflict: "vendor_id,author_id" },
      );
    if (error) toast.error("Could not save your rating");
    else {
      toast.success("Thanks for rating this vendor");
      setComment("");
      void qc.invalidateQueries({ queryKey: ["ratings", vendor.id] });
    }
  }

  if (!vendor) {
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted-foreground">Loading profile…</div>
      </AppShell>
    );
  }

  const isSelf = !!user && user.id === vendor.id;
  const avg = ratings?.length ? ratings.reduce((s, r) => s + r.stars, 0) / ratings.length : null;

  return (
    <AppShell>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" aria-label="Back" className="rounded-full p-1 hover:bg-secondary">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="truncate text-base font-bold">@{vendor.username}</h1>
      </header>

      <section className="border-b border-border p-4">
        <div className="flex items-start gap-4">
          <Avatar profile={vendor} size={72} />
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-lg font-extrabold">
              <span className="truncate">{vendor.display_name ?? vendor.username}</span>
              {vendor.is_verified && <BadgeCheck className="size-5 text-primary" />}
            </h2>
            <p className="flex items-center gap-1 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {vendor.neighborhoods?.name ? `${vendor.neighborhoods.name}, ` : ""}
              {vendor.towns?.name ?? "South West Region"}
            </p>
            <div className="mt-2 flex items-center gap-4 text-sm">
              <span>
                <b>{listings?.length ?? 0}</b>{" "}
                <span className="text-muted-foreground">listings</span>
              </span>
              <span>
                <b>{followState?.count ?? 0}</b>{" "}
                <span className="text-muted-foreground">followers</span>
              </span>
              {avg && (
                <span className="flex items-center gap-1 text-primary">
                  <Star className="size-3.5 fill-current" />
                  {avg.toFixed(1)}
                </span>
              )}
            </div>
          </div>
        </div>

        {vendor.bio && <p className="mt-3 text-sm text-foreground/90">{vendor.bio}</p>}

        <div className="mt-4 flex gap-2">
          {isSelf ? (
            <>
              <Link to="/edit-profile" className="flex-1">
                <Button variant="secondary" className="w-full rounded-full font-bold">
                  Edit profile
                </Button>
              </Link>
              <Link to="/profile" className="flex-1">
                <Button className="w-full rounded-full font-bold">Your dashboard</Button>
              </Link>
            </>
          ) : (
            <>
          <Button
            onClick={toggleFollow}
            variant={followState?.following ? "secondary" : "default"}
            className="flex-1 rounded-full font-bold"
          >
            {followState?.following ? "Following" : "Follow"}
          </Button>
          <Button
            variant="secondary"
            className="flex-1 rounded-full font-bold"
            onClick={async () => {
              const { data: number } = await supabase.rpc("get_vendor_whatsapp", {
                p_user_id: vendor.id,
              });
              if (!number) {
                toast("This vendor hasn't added a WhatsApp number yet");
                return;
              }
              window.open(whatsappLink(number, `your shop on Reezap`), "_blank", "noopener");
            }}
          >
            <MessageCircle className="mr-2 size-4" /> WhatsApp
          </Button>
            </>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3">
        {listings?.map((l) => (
          <Link
            key={l.id}
            to="/listing/$id"
            params={{ id: l.id }}
            className="relative bg-background"
          >
            <ListingMedia path={l.media_url} alt={l.title} />
            <div className="p-2">
              <p className="truncate text-xs font-semibold">{l.title}</p>
              <p className="text-xs text-primary">{formatPrice(l.price)}</p>
            </div>
            <div className="absolute left-2 top-2">
              <StatusPill status={l.status} fresh={isFresh(l.created_at)} />
            </div>
          </Link>
        ))}
      </section>

      <section className="space-y-4 p-4">
        <h3 className="font-bold">Ratings</h3>
        {user && user.id !== vendor.id && (
          <div className="rounded-xl border border-border bg-surface p-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} onClick={() => setStars(n)} aria-label={`${n} stars`}>
                  <Star
                    className={cn(
                      "size-6",
                      n <= stars ? "fill-current text-primary" : "text-muted-foreground",
                    )}
                  />
                </button>
              ))}
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="How was the experience?"
              className="mt-3"
            />
            <Button onClick={submitRating} className="mt-3 rounded-full font-bold">
              Submit rating
            </Button>
          </div>
        )}
        {!ratings?.length && (
          <p className="text-sm text-muted-foreground">No ratings yet for this vendor.</p>
        )}
        {ratings?.map((r) => (
          <div key={r.id} className="flex gap-3 border-b border-border pb-3">
            <Avatar profile={r.profiles as never} size={36} />
            <div>
              <p className="text-sm font-semibold">
                {(r.profiles as { display_name: string | null; username: string } | null)
                  ?.display_name ??
                  (r.profiles as { username: string } | null)?.username}
              </p>
              <div className="flex gap-0.5">
                {Array.from({ length: r.stars }).map((_, i) => (
                  <Star key={i} className="size-3 fill-current text-primary" />
                ))}
              </div>
              {r.comment && <p className="mt-1 text-sm text-foreground/90">{r.comment}</p>}
            </div>
          </div>
        ))}
      </section>
    </AppShell>
  );
}
