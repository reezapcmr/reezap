import { createFileRoute, Link } from "@tanstack/react-router";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { ListingCard, ListingCardSkeleton, type FeedListing } from "@/components/listing-card";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { ArrowUp, MapPin, RefreshCw, SlidersHorizontal } from "lucide-react";
import { LISTING_SELECT } from "@/lib/reezap";
import { toast } from "sonner";


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

const SORTS = {
  new: { label: "Newest", column: "created_at", ascending: false },
  popular: { label: "Most viewed", column: "view_count", ascending: false },
  cheap: { label: "Lowest price", column: "price", ascending: true },
} as const;
type SortKey = keyof typeof SORTS;

function Feed() {
  const { profile } = useAuth();
  const [scope, setScope] = useState<"near" | "all">("near");
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("new");
  const [showTop, setShowTop] = useState(false);

  // "Back to top" appears once the reader is a few screens deep.
  useEffect(() => {
    const onScroll = () => setShowTop(window.scrollY > 1200);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,

  } = useInfiniteQuery({
    queryKey: ["feed", townId, categoryId, sort],
    initialPageParam: 0,
    getNextPageParam: (last: FeedListing[], pages) =>
      last.length < PAGE_SIZE ? undefined : pages.length * PAGE_SIZE,
    queryFn: async ({ pageParam }) => {
      const from = pageParam as number;
      const s = SORTS[sort];
      let q = supabase
        .from("listings")
        .select(LISTING_SELECT)
        // Listings live for 48 hours so the timeline stays fresh.
        .gt("expires_at", new Date().toISOString())
        // Premium pinned posts ride at the top.
        .order("is_pinned", { ascending: false })
        .order(s.column, { ascending: s.ascending, nullsFirst: false })
        .range(from, from + PAGE_SIZE - 1);
      if (townId) q = q.eq("town_id", townId);
      if (categoryId) q = q.eq("category_id", categoryId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as FeedListing[];
    },
  });

  // Infinite scroll: fetch the next page when the sentinel scrolls into view.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage();
      },
      { rootMargin: "600px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

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
          <div className="flex items-center gap-2">
            <button
              aria-label="Refresh feed"
              onClick={async () => {
                await refetch();
                toast.success("Feed updated");
              }}
              disabled={isRefetching}
              className="flex size-9 items-center justify-center rounded-full border border-border disabled:opacity-60"
            >
              <RefreshCw className={cn("size-4", isRefetching && "animate-spin")} />
            </button>
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
          </div>
        }
      />
      <section className="border-b border-border px-4 py-3">
        {/* Segmented scope switch */}
        <div className="relative flex rounded-full bg-secondary p-1">
          <span
            aria-hidden
            className={cn(
              "absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-full bg-primary transition-transform duration-300 ease-out",
              scope === "all" && "translate-x-[calc(100%+0.5rem)]",
            )}
          />
          {(["near", "all"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              aria-pressed={scope === s}
              className={cn(
                "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 text-sm font-semibold transition-colors",
                scope === s ? "text-primary-foreground" : "text-muted-foreground",
              )}
            >
              {s === "near" && <MapPin className="size-3.5" />}
              {s === "near" ? "Near me" : "Whole region"}
            </button>
          ))}
        </div>
      </section>





      {isLoading && (
        <div aria-busy="true" aria-label="Loading listings">
          {[0, 1, 2].map((i) => (
            <ListingCardSkeleton key={i} />
          ))}
        </div>
      )}

      {isError && !listings.length && (
        <div className="px-6 py-16 text-center">
          <p className="font-semibold">Couldn't load the feed</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Check your connection and try again.
          </p>
          <button
            onClick={() => void refetch()}
            className="mt-5 rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground"
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && !listings?.length && (
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

      {listings.map((l: FeedListing) => <ListingCard key={l.id} listing={l} />)}

      {isFetchingNextPage && [0, 1].map((i) => <ListingCardSkeleton key={`next-${i}`} />)}

      {/* Auto-load the next page as the reader approaches the end. */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {hasNextPage && (
        <div className="px-4 py-6 text-center">
          <button
            onClick={() => void fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold disabled:opacity-50"
          >
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </button>
        </div>
      )}

      {showTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          aria-label="Back to top"
          className="fixed bottom-24 right-4 z-40 flex size-11 items-center justify-center rounded-full border border-border bg-background/90 shadow-lg backdrop-blur md:bottom-8"
        >
          <ArrowUp className="size-5" />
        </button>
      )}
    </AppShell>

  );
}
