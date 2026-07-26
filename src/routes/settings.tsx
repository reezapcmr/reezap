import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, LogOut } from "lucide-react";
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
import { stripExif } from "@/lib/reezap";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Reezap" },
      {
        name: "description",
        content: "Update your Reezap profile, location, WhatsApp number, language and verification.",
      },
      { property: "og:title", content: "Settings — Reezap" },
      { property: "og:description", content: "Manage your Reezap account and vendor details." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [townId, setTownId] = useState("");
  const [neighborhoodId, setNeighborhoodId] = useState("");
  const [language, setLanguage] = useState("en");
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/settings" } });
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.display_name ?? "");
    setBio(profile.bio ?? "");
    setWhatsapp(profile.whatsapp ?? "");
    setTownId(profile.town_id ?? "");
    setNeighborhoodId(profile.neighborhood_id ?? "");
    setLanguage(profile.language ?? "en");
  }, [profile]);

  const { data: towns } = useQuery({
    queryKey: ["towns"],
    queryFn: async () => (await supabase.from("towns").select("id,name").order("name")).data ?? [],
  });
  const { data: neighborhoods } = useQuery({
    queryKey: ["neighborhoods", townId],
    enabled: !!townId,
    queryFn: async () =>
      (await supabase.from("neighborhoods").select("id,name").eq("town_id", townId).order("name"))
        .data ?? [],
  });
  const { data: verification, refetch } = useQuery({
    queryKey: ["verification", user?.id],
    enabled: !!user,
    queryFn: async () =>
      (
        await supabase
          .from("verification_requests")
          .select("id,status,created_at")
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle()
      ).data,
  });

  async function save() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || null,
        bio: bio || null,
        whatsapp: whatsapp || null,
        town_id: townId || null,
        neighborhood_id: neighborhoodId || null,
        language,
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) toast.error("Could not save your changes");
    else {
      toast.success("Profile updated");
      await refreshProfile();
    }
  }

  async function uploadAvatar(file: File) {
    if (!user) return;
    const blob = await stripExif(file);
    const path = `${user.id}/avatar-${Date.now()}.jpg`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, blob, { contentType: "image/jpeg" });
    if (error) {
      toast.error("Could not upload photo");
      return;
    }
    await supabase.from("profiles").update({ avatar_url: path }).eq("id", user.id);
    await refreshProfile();
    toast.success("Photo updated");
  }

  async function submitVerification() {
    if (!user || !idFile || !fullName.trim()) {
      toast.error("Add your full name and a photo of your ID");
      return;
    }
    setBusy(true);
    try {
      const path = `${user.id}/${crypto.randomUUID()}.jpg`;
      const blob = await stripExif(idFile);
      const { error: upErr } = await supabase.storage
        .from("id-documents")
        .upload(path, blob, { contentType: "image/jpeg" });
      if (upErr) throw upErr;
      const { error } = await supabase.from("verification_requests").insert({
        user_id: user.id,
        full_name: fullName.trim(),
        document_path: path,
      });
      if (error) throw error;
      toast.success("Submitted — our team reviews IDs within a few days.");
      setIdFile(null);
      void refetch();
    } catch {
      toast.error("Could not submit your verification request");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <TopBar title="Settings" />
      <div className="space-y-6 p-4">
        <section className="space-y-4">
          <h2 className="font-bold">Profile</h2>
          <label className="block text-sm">
            <span className="text-muted-foreground">Profile photo</span>
            <input
              type="file"
              accept="image/*"
              className="mt-2 block w-full text-sm text-muted-foreground"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void uploadAvatar(f);
              }}
            />
          </label>
          <div className="space-y-1.5">
            <Label htmlFor="dn">Display name</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <Textarea id="bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa">WhatsApp number</Label>
            <Input id="wa" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} />
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
            <Label>Language</Label>
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button onClick={save} disabled={busy} className="w-full rounded-full font-bold">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            Save changes
          </Button>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Verification</h2>
          {profile?.is_verified ? (
            <p className="text-sm text-primary">Your account is verified.</p>
          ) : verification?.status === "pending" ? (
            <p className="text-sm text-muted-foreground">
              Your request is under review. We'll notify you once it's decided.
            </p>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">
                Submit a government ID to earn the trust badge. Your document is stored privately
                and only reviewed by our admin team.
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="fn">Full name on ID</Label>
                <Input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <input
                type="file"
                accept="image/*"
                className="block w-full text-sm text-muted-foreground"
                onChange={(e) => setIdFile(e.target.files?.[0] ?? null)}
              />
              <Button
                onClick={submitVerification}
                disabled={busy}
                variant="secondary"
                className="w-full rounded-full font-bold"
              >
                Submit for verification
              </Button>
            </>
          )}
        </section>

        <Button
          variant="secondary"
          className="w-full rounded-full font-bold"
          onClick={async () => {
            await signOut();
            void navigate({ to: "/" });
          }}
        >
          <LogOut className="mr-2 size-4" /> Sign out
        </Button>
      </div>
    </AppShell>
  );
}
