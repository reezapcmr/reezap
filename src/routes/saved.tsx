import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Bookmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { ListingCard, type FeedListing } from "@/components/listing-card";
import { LISTING_SELECT } from "@/lib/reezap";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/saved")({
  head: () => ({
    meta: [
      { title: "Saved listings — Reezap" },
      {
        name: "description",
        content: "Everything you bookmarked on Reezap, ready when you are.",
      },
      { property: "og:title", content: "Saved listings — Reezap" },
      { property: "og:description", content: "Your bookmarked vendors and products on Reezap." },
    ],
  }),
  component: SavedPage,
});


function SavedPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/saved" } });
  }, [loading, user, navigate]);

  const { data: listings } = useQuery({
    queryKey: ["saved", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: marks } = await supabase
        .from("bookmarks")
        .select("listing_id")
        .eq("user_id", user!.id);
      const ids = (marks ?? []).map((m) => m.listing_id);
      if (!ids.length) return [];
      const { data } = await supabase.from("listings").select(LISTING_SELECT).in("id", ids);
      return (data ?? []) as unknown as FeedListing[];
    },
  });

  return (
    <AppShell>
      <TopBar title="Saved" />
      {!listings?.length && (
        <div className="px-6 py-20 text-center">
          <Bookmark className="mx-auto size-7 text-muted-foreground" />
          <p className="mt-3 font-semibold">No saved listings yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tap the bookmark icon on any listing to keep it here.
          </p>
          <Link to="/" className="mt-5 inline-block text-sm font-semibold text-primary">
            Browse the feed
          </Link>
        </div>
      )}
      {listings?.map((l) => <ListingCard key={l.id} listing={l} />)}
    </AppShell>
  );
}
