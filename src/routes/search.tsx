import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search as SearchIcon, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { Avatar, ListingCard, type FeedListing } from "@/components/listing-card";
import { LISTING_SELECT } from "@/lib/reezap";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search vendors and listings — Reezap" },
      {
        name: "description",
        content:
          "Search Reezap for vendors, products and services by name, category or town across the South West Region.",
      },
      { property: "og:title", content: "Search vendors and listings — Reezap" },
      {
        property: "og:description",
        content: "Find exactly what you need near Buea, Limbe, Kumba, Mamfe and more.",
      },
    ],
  }),
  component: SearchPage,
});


function SearchPage() {
  const [q, setQ] = useState("");
  const [townId, setTownId] = useState<string | null>(null);

  const { data: towns } = useQuery({
    queryKey: ["towns"],
    queryFn: async () => {
      const { data } = await supabase.from("towns").select("id,name,division").order("name");
      return data ?? [];
    },
  });

  const term = useMemo(() => q.trim(), [q]);

  const { data: listings } = useQuery({
    queryKey: ["search-listings", term, townId],
    queryFn: async () => {
      let query = supabase
        .from("listings")
        .select(LISTING_SELECT)
        .order("created_at", { ascending: false })
        .limit(30);
      if (term) query = query.or(`title.ilike.%${term}%,description.ilike.%${term}%`);
      if (townId) query = query.eq("town_id", townId);
      const { data } = await query;
      return (data ?? []) as unknown as FeedListing[];
    },
  });

  const { data: vendors } = useQuery({
    queryKey: ["search-vendors", term, townId],
    queryFn: async () => {
      let query = supabase
        .from("profiles")
        .select("id,username,display_name,avatar_url,bio,is_verified,towns(name)")
        .eq("is_vendor", true)
        .limit(20);
      if (term) query = query.or(`username.ilike.%${term}%,display_name.ilike.%${term}%`);
      if (townId) query = query.eq("town_id", townId);
      const { data } = await query;
      return data ?? [];
    },
  });

  return (
    <AppShell>
      <TopBar title="Search" />
      <div className="space-y-3 border-b border-border p-4">
        <div className="relative">
          <SearchIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search fish, braids, phone repair…"
            className="rounded-full pl-9"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto">
          <button
            onClick={() => setTownId(null)}
            className={cn(
              "shrink-0 rounded-full border border-border px-3.5 py-1.5 text-sm",
              !townId && "border-primary text-primary",
            )}
          >
            All towns
          </button>
          {towns?.map((t) => (
            <button
              key={t.id}
              onClick={() => setTownId(t.id)}
              className={cn(
                "shrink-0 rounded-full border border-border px-3.5 py-1.5 text-sm",
                townId === t.id && "border-primary text-primary",
              )}
            >
              {t.name}
            </button>
          ))}
        </div>
      </div>

      <Tabs defaultValue="listings">
        <TabsList className="m-4 grid w-[calc(100%-2rem)] grid-cols-2 rounded-full bg-secondary">
          <TabsTrigger value="listings" className="rounded-full">
            Listings
          </TabsTrigger>
          <TabsTrigger value="vendors" className="rounded-full">
            Vendors
          </TabsTrigger>
        </TabsList>

        <TabsContent value="listings">
          {!listings?.length && (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              No listings match that search.
            </p>
          )}
          {listings?.map((l) => <ListingCard key={l.id} listing={l} />)}
        </TabsContent>

        <TabsContent value="vendors" className="divide-y divide-border">
          {!vendors?.length && (
            <p className="px-6 py-12 text-center text-sm text-muted-foreground">
              No vendors match that search.
            </p>
          )}
          {vendors?.map((v) => (
            <Link
              key={v.id}
              to="/u/$username"
              params={{ username: v.username }}
              className="flex items-center gap-3 px-4 py-3.5"
            >
              <Avatar profile={v} size={44} />
              <div className="min-w-0">
                <p className="flex items-center gap-1 text-sm font-semibold">
                  <span className="truncate">{v.display_name ?? v.username}</span>
                  {v.is_verified && <BadgeCheck className="size-4 text-primary" />}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  @{v.username}
                  {v.towns?.name ? ` · ${v.towns.name}` : ""}
                </p>
              </div>
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}
