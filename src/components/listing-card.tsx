import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Bookmark, Heart, ImageIcon, MapPin, Pin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import {
  expiresIn,
  formatPrice,
  galleryPaths,
  isFresh,
  resolveMedia,
  resolveMediaList,
  timeAgo,
} from "@/lib/reezap";
import { toast } from "sonner";

export type FeedListing = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  media_url: string | null;
  media_urls: string[] | null;
  status: "in_stock" | "sold_out_today";
  created_at: string;
  expires_at: string | null;
  is_pinned?: boolean | null;
  town_id: string | null;
  neighborhood_id: string | null;
  towns: { name: string; division: string } | null;
  neighborhoods: { name: string } | null;
  categories: { name: string; emoji: string | null } | null;
  profiles: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    is_verified: boolean;
  } | null;
  likes?: { count: number }[];
};

function Placeholder({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "flex aspect-[4/3] w-full items-center justify-center bg-secondary text-muted-foreground",
        className,
      )}
    >
      <ImageIcon className="size-6" />
    </div>
  );
}

export function ListingMedia({ path, alt }: { path: string | null; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSrc(null);
    void resolveMedia(path).then((url) => active && setSrc(url));
    return () => {
      active = false;
    };
  }, [path]);

  if (!src || failed) return <Placeholder />;
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[4/3] w-full object-cover"
      width={800}
      height={600}
    />
  );
}

/** Swipeable gallery of up to 3 photos, used on listing detail pages. */
export function ListingGallery({ paths, alt }: { paths: string[]; alt: string }) {
  const [urls, setUrls] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const key = paths.join("|");

  useEffect(() => {
    let active = true;
    void resolveMediaList(paths).then((u) => {
      if (!active) return;
      setUrls(u);
      setIndex(0);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  if (!urls.length) return <Placeholder />;

  return (
    <div className="relative">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => {
          const el = e.currentTarget;
          setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
        }}
      >
        {urls.map((u, i) => (
          <img
            key={u}
            src={u}
            alt={`${alt} — photo ${i + 1}`}
            className="aspect-[4/3] w-full shrink-0 snap-center object-cover"
            width={800}
            height={600}
          />
        ))}
      </div>
      {urls.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
          {urls.map((u, i) => (
            <span
              key={u}
              className={cn(
                "size-1.5 rounded-full transition-colors",
                i === index ? "bg-primary" : "bg-foreground/30",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function ListingCard({ listing }: { listing: FeedListing }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(listing.likes?.[0]?.count ?? 0);
  const vendor = listing.profiles;
  const photos = galleryPaths(listing);

  useEffect(() => {
    setLikes(listing.likes?.[0]?.count ?? 0);
  }, [listing.likes]);

  useEffect(() => {
    if (!user) {
      setSaved(false);
      setLiked(false);
      return;
    }
    let active = true;
    void (async () => {
      const [{ data: b }, { data: l }] = await Promise.all([
        supabase
          .from("bookmarks")
          .select("listing_id")
          .eq("listing_id", listing.id)
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase
          .from("likes")
          .select("listing_id")
          .eq("listing_id", listing.id)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (!active) return;
      setSaved(!!b);
      setLiked(!!l);
    })();
    return () => {
      active = false;
    };
  }, [user, listing.id]);

  async function toggle(kind: "bookmarks" | "likes", on: boolean, set: (v: boolean) => void) {
    if (!user) {
      toast("Sign in to save and like listings");
      return;
    }
    set(!on);
    if (kind === "likes") setLikes((n) => Math.max(0, n + (on ? -1 : 1)));

    const { error } = on
      ? await supabase.from(kind).delete().eq("listing_id", listing.id).eq("user_id", user.id)
      : await supabase.from(kind).insert({ listing_id: listing.id, user_id: user.id });

    if (error) {
      set(on);
      if (kind === "likes") setLikes((n) => Math.max(0, n + (on ? 1 : -1)));
      return;
    }
    void qc.invalidateQueries({ queryKey: ["saved"] });
  }

  const countdown = expiresIn(listing.expires_at);

  return (
    <article className="border-b border-border py-4">
      <div className="flex items-center gap-3 px-4">
        <Link to="/u/$username" params={{ username: vendor?.username ?? "" }}>
          <Avatar profile={vendor} />
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            to="/u/$username"
            params={{ username: vendor?.username ?? "" }}
            className="flex items-center gap-1 text-sm font-semibold hover:underline"
          >
            <span className="truncate">{vendor?.display_name ?? vendor?.username}</span>
            {vendor?.is_verified && <BadgeCheck className="size-4 shrink-0 text-primary" />}
          </Link>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3" />
            {listing.neighborhoods?.name ?? listing.towns?.name ?? "South West"} ·{" "}
            {timeAgo(listing.created_at)}
          </p>
        </div>
        {listing.is_pinned && <Pin className="size-4 text-primary" aria-label="Pinned" />}
        <StatusPill status={listing.status} fresh={isFresh(listing.created_at)} />
      </div>

      <Link to="/listing/$id" params={{ id: listing.id }} className="mt-3 block">
        <div className="relative overflow-hidden rounded-xl border border-border">
          <ListingMedia path={photos[0] ?? null} alt={listing.title} />
          {photos.length > 1 && (
            <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-background/80 px-2 py-0.5 text-[11px] font-semibold backdrop-blur">
              <ImageIcon className="size-3" /> {photos.length}
            </span>
          )}
        </div>
      </Link>

      <div className="px-4">
        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              to="/listing/$id"
              params={{ id: listing.id }}
              className="block truncate font-semibold hover:underline"
            >
              {listing.title}
            </Link>
            {listing.description && (
              <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">
                {listing.description}
              </p>
            )}
          </div>
          <span className="shrink-0 rounded-full bg-secondary px-3 py-1 text-sm font-bold text-primary">
            {formatPrice(listing.price)}
          </span>
        </div>

        <div className="mt-3 flex items-center gap-4 text-muted-foreground">
          <button
            onClick={() => toggle("likes", liked, setLiked)}
            aria-label="Like"
            className={cn("flex items-center gap-1.5 text-sm", liked && "text-primary")}
          >
            <Heart className={cn("size-5", liked && "fill-current")} />
            {likes > 0 && <span className="text-xs font-semibold">{likes}</span>}
          </button>
          <button
            onClick={() => toggle("bookmarks", saved, setSaved)}
            aria-label="Save"
            className={cn("flex items-center gap-1.5 text-sm", saved && "text-primary")}
          >
            <Bookmark className={cn("size-5", saved && "fill-current")} />
          </button>
          {countdown && <span className="text-[11px] text-muted-foreground">{countdown}</span>}
          {listing.categories && (
            <span className="ml-auto text-xs text-muted-foreground">
              {listing.categories.emoji} {listing.categories.name}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}

export function StatusPill({ status, fresh }: { status: string; fresh?: boolean }) {
  if (status === "sold_out_today") {
    return (
      <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
        Sold out today
      </span>
    );
  }
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold",
        fresh ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground",
      )}
    >
      In stock
    </span>
  );
}

export function Avatar({
  profile,
  size = 40,
}: {
  profile: { username: string; display_name: string | null; avatar_url: string | null } | null;
  size?: number;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);
    setSrc(null);
    void resolveMedia(profile?.avatar_url, "avatars").then((u) => active && setSrc(u));
    return () => {
      active = false;
    };
  }, [profile?.avatar_url]);

  const initial = (profile?.display_name ?? profile?.username ?? "?").charAt(0).toUpperCase();
  return src && !failed ? (
    <img
      src={src}
      alt={profile?.username ?? "avatar"}
      width={size}
      height={size}
      onError={() => setFailed(true)}
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {initial}
    </span>
  );
}
