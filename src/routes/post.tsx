import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, ImagePlus } from "lucide-react";
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
import { looksLikeSpam, stripExif } from "@/lib/reezap";

export const Route = createFileRoute("/post")({
  head: () => ({
    meta: [
      { title: "Post a listing — Reezap" },
      {
        name: "description",
        content:
          "Share what you're selling today. Add a photo, price and location, and buyers reach you on WhatsApp.",
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
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!file) {
      toast.error("Add a photo of what you're selling");
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
      const blob = await stripExif(file);
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const { error: upErr } = await supabase.storage
        .from("listing-media")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;

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
        media_url: path,
        media_type: "image",
        status: "in_stock",
      });
      if (error) throw error;

      await refreshProfile();
      toast.success("Posted! Your vendor dashboard is now unlocked.");
      void navigate({ to: "/profile" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not post your listing");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Post something" />
      <form onSubmit={submit} className="space-y-5 p-4">
        <label className="block cursor-pointer">
          <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-dashed border-border bg-surface">
            {preview ? (
              <img src={preview} alt="Preview" className="size-full object-cover" />
            ) : (
              <span className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
                <ImagePlus className="size-7" />
                Add a photo
              </span>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <p className="-mt-3 text-xs text-muted-foreground">
          Location data is removed from your photo before upload.
        </p>

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

        <Button type="submit" disabled={busy} className="w-full rounded-full py-6 font-bold">
          {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
          Publish listing
        </Button>
      </form>
    </AppShell>
  );
}
