import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Eye,
  Flag,
  MapPin,
  MessageCircle,
  Star,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/app-shell";
import { Avatar, ListingMedia, StatusPill } from "@/components/listing-card";
import { Button } from "@/components/ui/button";
import { formatPrice, isFresh, proximityLabel, timeAgo, whatsappLink } from "@/lib/reezap";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/listing/$id")({
  head: () => ({
    meta: [
      { title: "Listing — Reezap" },
      {
        name: "description",
        content: "See the full details of this listing and order the vendor directly on WhatsApp.",
      },
      { property: "og:title", content: "Listing — Reezap" },
      {
        property: "og:description",
        content: "Local listing on Reezap. Tap through to order on WhatsApp.",
      },
    ],
  }),
  component: ListingPage,
});

function ListingPage() {
  const { id } = Route.useParams();
  const { profile, user } = useAuth();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [reportOpen, setReportOpen] = useState(false);

  const { data: listing } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("listings")
        .select(
          "id,title,description,price,media_url,status,created_at,view_count,whatsapp_click_count,town_id,neighborhood_id,towns(name,division),neighborhoods(name),categories(name,emoji),profiles!listings_vendor_id_fkey(id,username,display_name,avatar_url,is_verified,whatsapp)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const vendor = listing?.profiles as
    | {
        id: string;
        username: string;
        display_name: string | null;
        avatar_url: string | null;
        is_verified: boolean;
        whatsapp: string | null;
      }
    | null;

  const { data: rating } = useQuery({
    queryKey: ["vendor-rating", vendor?.id],
    enabled: !!vendor?.id,
    queryFn: async () => {
      const { data } = await supabase.from("ratings").select("stars").eq("vendor_id", vendor!.id);
      if (!data?.length) return null;
      return {
        avg: data.reduce((s, r) => s + r.stars, 0) / data.length,
        count: data.length,
      };
    },
  });

  useEffect(() => {
    if (!listing) return;
    void supabase
      .from("listings")
      .update({ view_count: (listing.view_count ?? 0) + 1 })
      .eq("id", listing.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing?.id]);

  async function handleOrder() {
    if (!listing || !vendor) return;
    await supabase
      .from("listings")
      .update({ whatsapp_click_count: (listing.whatsapp_click_count ?? 0) + 1 })
      .eq("id", listing.id);
    window.open(whatsappLink(vendor.whatsapp, listing.title), "_blank", "noopener");
  }

  async function submitReport() {
    if (!user) {
      toast("Sign in to report a listing");
      return;
    }
    if (!reason) return;
    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      target_type: "listing",
      target_id: id,
      reason: reason as "fake" | "fraud" | "inappropriate" | "other" | "spam",
      details: details || null,
    });
    if (error) toast.error("Could not send report");
    else {
      toast.success("Thanks — our team will review this listing.");
      setReportOpen(false);
      setDetails("");
    }
  }

  if (!listing || !vendor) {
    return (
      <AppShell>
        <div className="p-6 text-sm text-muted-foreground">Loading listing…</div>
      </AppShell>
    );
  }

  const distance = proximityLabel(profile, listing);

  return (
    <AppShell>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/90 px-4 py-3 backdrop-blur">
        <Link to="/" aria-label="Back" className="rounded-full p-1 hover:bg-secondary">
          <ArrowLeft className="size-5" />
        </Link>
        <h1 className="truncate text-base font-bold">{listing.title}</h1>
      </header>

      <ListingMedia path={listing.media_url} alt={listing.title} />

      <div className="space-y-5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-extrabold">{listing.title}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-3.5" />
              {listing.neighborhoods?.name ?? ""}
              {listing.neighborhoods?.name ? ", " : ""}
              {listing.towns?.name}
              {distance && <span className="text-primary">· {distance}</span>}
            </p>
          </div>
          <StatusPill status={listing.status} fresh={isFresh(listing.created_at)} />
        </div>

        <p className="text-2xl font-extrabold text-primary">{formatPrice(listing.price)}</p>

        {listing.description && (
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground/90">
            {listing.description}
          </p>
        )}

        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Eye className="size-3.5" /> {listing.view_count ?? 0} views
          </span>
          <span>Posted {timeAgo(listing.created_at)}</span>
          {listing.categories && (
            <span>
              {listing.categories.emoji} {listing.categories.name}
            </span>
          )}
        </div>

        <Link
          to="/u/$username"
          params={{ username: vendor.username }}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
        >
          <Avatar profile={vendor} size={46} />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 font-semibold">
              <span className="truncate">{vendor.display_name ?? vendor.username}</span>
              {vendor.is_verified && <BadgeCheck className="size-4 text-primary" />}
            </p>
            <p className="text-xs text-muted-foreground">
              @{vendor.username}
              {rating && (
                <span className="ml-2 inline-flex items-center gap-1 text-primary">
                  <Star className="size-3 fill-current" />
                  {rating.avg.toFixed(1)} ({rating.count})
                </span>
              )}
            </p>
          </div>
        </Link>

        <p className="rounded-lg bg-secondary p-3 text-xs text-muted-foreground">
          Reezap connects you with the vendor. Payment and delivery are arranged directly between
          you two — meet in a public place and check goods before paying.
        </p>

        <Dialog open={reportOpen} onOpenChange={setReportOpen}>
          <DialogTrigger asChild>
            <button className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Flag className="size-3.5" /> Report this listing
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Report listing</DialogTitle>
            </DialogHeader>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Why are you reporting this?" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fraud">Scam or fraud</SelectItem>
                <SelectItem value="fake">Fake or counterfeit goods</SelectItem>
                <SelectItem value="inappropriate">Inappropriate content</SelectItem>
                <SelectItem value="spam">Spam</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Add any detail that helps us review (optional)"
              rows={3}
            />
            <Button onClick={submitReport} className="rounded-full font-bold">
              Send report
            </Button>
          </DialogContent>
        </Dialog>
      </div>

      <div className="fixed inset-x-0 bottom-16 z-30 px-4 lg:bottom-6 lg:left-60">
        <div className="mx-auto max-w-2xl">
          <Button
            onClick={handleOrder}
            className="w-full rounded-full py-6 text-base font-bold shadow-glow"
          >
            <MessageCircle className="mr-2 size-5" /> Order on WhatsApp
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
