import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  looksLikeSpam,
  stripExif,
  wordCount,
  MAX_LISTING_PHOTOS,
  MAX_DESCRIPTION_WORDS,
  FREE_DAILY_POST_LIMIT,
} from "@/lib/reezap";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Post a listing — Reezap" },
      {
        name: "description",
        content:
          "Share what you're selling today. Add up to 3 photos, price and location, and buyers reach you on WhatsApp.",
      },
      { property: "og:title", content: "Post a listing — Reezap" },
      {
        property: "og:description",
        content: "Post in under a minute and start receiving WhatsApp orders.",
      },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { user, profile, loading, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [townId, setTownId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const isPremium =
    !!profile?.is_premium &&
    (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now());

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/post" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profile) {
      setWhatsapp((w) => w || profile.whatsapp || "");
      setTownId((t) => t || profile.town_id || "");
      setNeighborhoodId((n) => n || profile.neighborhood_id || "");
    }
  }, [profile]);

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("id,name,emoji").order("name")).data ?? [],
  });
  const { data: towns } = useQuery({
    queryKey: ["towns"],
    queryFn: async () => (await supabase.from("towns").select("id,name,division").order("name")).data ?? [],
  });
  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods", townId],
    enabled: !!townId,
    queryFn: async () =>
      (await supabase.from("neighborhoods").select("id,name").eq("town_id", townId).order("name"))
        .data ?? [],
  });

  const { data: todayCount } = useQuery({
    queryKey: ["posts-today", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { count } = await supabase
        .from("listings")
        .select("id", { count: "exact", head: true })
        .eq("vendor_id", user!.id)
        .gte("created_at", start.toISOString());
      return count ?? 0;
    },
  });

  function addFiles(list: FileList | null) {
    if (!list?.length) return;
    const incoming = Array.from(list);
    const next = [...files, ...incoming].slice(0, MAX_LISTING_PHOTOS);
    if (files.length + incoming.length > MAX_LISTING_PHOTOS) {
      toast(`You can add up to ${MAX_LISTING_PHOTOS} photos per listing`);
    }
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  function removeFile(index: number) {
    const next = files.filter((_, i) => i !== index);
    setFiles(next);
    setPreviews(next.map((f) => URL.createObjectURL(f)));
  }

  const words = wordCount(description);
  const overWordLimit = words > MAX_DESCRIPTION_WORDS;
  const atDailyLimit = !isPremium && (todayCount ?? 0) >= FREE_DAILY_POST_LIMIT;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!files.length) {
      toast.error("Add at least one photo of what you're selling");
      return;
    }
    if (overWordLimit) {
      toast.error(`Keep your description under ${MAX_DESCRIPTION_WORDS} words`);
      return;
    }
    if (looksLikeSpam(`${title} ${description}`)) {
      toast.error("That post looks like spam. Please describe a real product or service.");
      return;
    }
    const digits = whatsapp.replace(/[^0-9]/g, "");
    if (digits.length < 8) {
      toast.error("Add a valid WhatsApp number so buyers can reach you");
      return;
    }

    setBusy(true);
    try {
      const paths: string[] = [];
      for (const f of files.slice(0, MAX_LISTING_PHOTOS)) {
        const blob = await stripExif(f);
        const path = `${user.id}/${crypto.randomUUID()}.jpg`;
        const { error: upErr } = await supabase.storage
          .from("listing-media")
          .upload(path, blob, { contentType: "image/jpeg" });
        if (upErr) throw upErr;
        paths.push(path);
      }

      if (profile?.whatsapp !== whatsapp || profile?.town_id !== townId) {
        await supabase
          .from("profiles")
          .update({
            whatsapp,
            town_id: townId || null,
            neighborhood_id: neighborhoodId || null,
          })
          .eq("id", user.id);
      }

      const { error } = await supabase.from("listings").insert({
        vendor_id: user.id,
        title: title.trim(),
        description: description.trim() || null,
        price: price ? Number(price) : null,
        category_id: categoryId || null,
        town_id: townId || null,
        neighborhood_id: neighborhoodId || null,
        media_url: paths[0],
        media_urls: paths,
        media_type: "image",
        status: "in_stock",
      });
      if (error) throw error;

      await refreshProfile();
      toast.success("Posted! It stays live for 48 hours.");
      void navigate({ to: "/profile" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not post your listing";
      if (message.includes("daily_post_limit_reached")) {
        toast.error(`Free accounts can post ${FREE_DAILY_POST_LIMIT} times a day. Go premium for more.`);
        void navigate({ to: "/premium" });
      } else if (message.includes("max_three_photos")) {
        toast.error(`Maximum ${MAX_LISTING_PHOTOS} photos per listing`);
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Post something" />
      <form onSubmit={submit} className="space-y-5 p-4">
        <div className="grid grid-cols-3 gap-2">
          {previews.map((src, i) => (
            <div key={src} className="relative aspect-square overflow-hidden rounded-xl">
              <img src={src} alt={`Photo ${i + 1}`} className="size-full object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => removeFile(i)}
                className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {files.length < MAX_LISTING_PHOTOS && (
            <label className="flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border bg-surface text-xs text-muted-foreground">
              <ImagePlus className="size-6" />
              Add photo
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(e) => {
                  addFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          )}
        </div>
        <p className="-mt-3 text-xs text-muted-foreground">
          Up to {MAX_LISTING_PHOTOS} photos. Location data is removed from your photos before upload.
        </p>

        {atDailyLimit && (
          <div className="rounded-xl border border-primary/40 bg-surface p-3 text-sm">
            You've used all {FREE_DAILY_POST_LIMIT} free posts today.{" "}
            <a href="/premium" className="font-bold text-primary">
              Go premium
            </a>{" "}
            to post more and pin your listings.
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="title">What are you selling?</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Fresh tomatoes basket"
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="desc">Details</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Quantity, quality, pickup or delivery…"
            rows={3}
          />
          <p
            className={
              overWordLimit ? "text-xs font-semibold text-destructive" : "text-xs text-muted-foreground"
            }
          >
            {words}/{MAX_DESCRIPTION_WORDS} words
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="price">Price (FCFA)</Label>
            <Input
              id="price"
              type="number"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="3500"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {categories?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.emoji} {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Town</Label>
            <Select
              value={townId}
              onValueChange={(v) => {
                setTownId(v);
                setNeighborhoodId("");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {towns?.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Neighborhood</Label>
            <Select value={neighborhoodId} onValueChange={setNeighborhoodId} disabled={!townId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose" />
              </SelectTrigger>
              <SelectContent>
                {neighborhoods?.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="wa">WhatsApp number</Label>
          <Input
            id="wa"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="+237 6XX XXX XXX"
            required
          />
          <p className="text-xs text-muted-foreground">
            Buyers tap "Order on WhatsApp" and chat with you directly. Reezap never handles payment.
          </p>
        </div>

        <Button
          type="submit"
          disabled={busy || overWordLimit}
          className="w-full rounded-full py-6 font-bold"
        >
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          Publish listing
        </Button>
      </form>
    </AppShell>
  );
}
