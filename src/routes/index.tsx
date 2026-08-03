import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { ListingCard, type FeedListing } from "@/components/listing-card";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MapPin, SlidersHorizontal } from "lucide-react";
import { LISTING_SELECT } from "@/lib/reezap";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Reezap" },
      {
        name: "description",
        content:
          "Find food, fashion, beauty, repairs and services from vendors around Buea, Limbe, Kumba and beyond. Order straight on WhatsApp.",
      },
      { property: "og:title", content: "Reezap" },
      {
        property: "og:description",
        content:
          "Find food, fashion, beauty, repairs and services from vendors around Buea, Limbe, Kumba and beyond. Order straight on WhatsApp.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Feed,
});

const PAGE_SIZE = 12;

function Feed() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<"near" | "all">("near");
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    staleTime: 60 * 60 * 1000,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id,name,emoji,slug").order("name");
      return data ?? [];
    },
  });

  const townId = scope === "near" ? (profile?.town_id ?? null) : null;

  const {
    data,
    isLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["feed", townId, categoryId],
    initialPageParam: 0,
    getNextPageParam: (last: FeedListing[], pages) =>
      last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    queryFn: async ({ pageParam }) => {
      const from = pageParam as number;
      let q = supabase
        .from("listings")
        .select(LISTING_SELECT)
        // Listings live for 48 hours so the timeline stays fresh.
        .gt("expires_at", new Date().toISOString())
        // Premium pinned posts ride at the top.
        .order("is_pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .range(from, from + PAGE_SIZE - 1);
      if (townId) q = q.eq("town_id", townId);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FeedListing[];
    },
  });

  const listings = data?.pages.flat() ?? [];


  const activeCategory = categories?.find((c) => c.id === categoryId) ?? null;

  return (
    <AppShell>
      <TopBar
        title={
          <span className="text-[0.95rem] font-extrabold tracking-[0.28em] text-foreground">
            REEZAP
          </span>
        }
        right={
          <Sheet>
            <SheetTrigger asChild>
              <button
                aria-label="Filter categories"
                className={cn(
                  "flex items-center gap-2 rounded-full border border-border px-3.5 py-1.5 text-sm font-semibold",
                  categoryId && "border-primary text-primary",
                )}
              >
                <SlidersHorizontal className="size-4" />
                {activeCategory ? `${activeCategory.emoji ?? ""} ${activeCategory.name}` : "Filter"}
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="max-h-[75vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>Filter by category</SheetTitle>
              </SheetHeader>
              <div className="mt-5 flex flex-wrap gap-2 pb-4">
                <button
                  onClick={() => setCategoryId(null)}
                  className={cn(
                    "rounded-full border border-border px-3.5 py-2 text-sm",
                    !categoryId && "border-primary text-primary",
                  )}
                >
                  All categories
                </button>
                {categories?.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setCategoryId(c.id)}
                    className={cn(
                      "rounded-full border border-border px-3.5 py-2 text-sm",
                      categoryId === c.id && "border-primary text-primary",
                    )}
                  >
                    {c.emoji} {c.name}
                  </button>
                ))}
              </div>
            </SheetContent>
          </Sheet>
        }
      />
      <section className="border-b border-border px-4 py-5">
        <h1 className="text-2xl font-extrabold leading-tight">
          What's fresh <span className="text-primary">near you</span>
        </h1>
        <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-3.5" />
          {profile?.town_id && scope === "near"
            ? "Showing your town first"
            : "South West Region, Cameroon"}
        </p>
        <div className="mt-4 flex gap-2">
          {(["near", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-semibold transition-colors",
                scope === s
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground",
              )}
            >
              {s === "near" ? "Near me" : "Whole region"}
            </button>
          ))}
        </div>
      </section>


      {isLoading && (
        <div className="space-y-6 p-4">
          {[0, 1].map((i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-10 w-1/2" />
              <Skeleton className="aspect-[4/3] w-full" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !listings?.length && (
        <div className="px-6 py-16 text-center">
          <p className="font-semibold">Nothing here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Be the first to post something in this area.
          </p>
          <Link
            to="/post"
            className="mt-5 inline-block rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Post a listing
          </Link>
        </div>
      )}

      {listings?.map((l) => <ListingCard key={l.id} listing={l} />)}
    </AppShell>
  );
}
