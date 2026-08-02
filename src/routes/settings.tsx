import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  BadgeCheck,
  Bookmark,
  ChevronRight,
  Crown,
  Info,
  KeyRound,
  LifeBuoy,
  Lock,
  LogOut,
  Share2,
  ShieldOff,
  Trash2,
  UserPen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { useLanguage } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Reezap" },
      {
        name: "description",
        content:
          "Manage your Reezap preferences, notification settings, language, privacy policy and support.",
      },
      { property: "og:title", content: "Settings — Reezap" },
      { property: "og:description", content: "Preferences, privacy and support for your Reezap account." },
    ],
  }),
  component: SettingsPage,
});

const APP_VERSION = "1.0.0";
const SUPPORT_WHATSAPP = "https://wa.me/237600000000?text=Hello%20Reezap%20support";

function SettingsPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const { lang, setLang } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/settings" } });
  }, [loading, user, navigate]);

  // Keep the saved profile language and the live UI language in step.
  useEffect(() => {
    if (profile?.language === "fr" || profile?.language === "en") {
      if (profile.language !== lang) setLang(profile.language);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.language]);

  const { data: blocked } = useQuery({
    queryKey: ["blocked", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("blocks")
        .select("blocked_id, profiles!blocks_blocked_id_fkey(username,display_name)")
        .eq("blocker_id", user!.id);
      return (data ?? []) as unknown as {
        blocked_id: string;
        profiles: { username: string; display_name: string | null } | null;
      }[];
    },
  });

  async function patch(values: {
    language?: string;
    notify_follows?: boolean;
    notify_likes?: boolean;
    notify_moderation?: boolean;
  }) {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(values).eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Could not save your preference");
    else await refreshProfile();
  }

  async function sendResetLink() {
    if (!user?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: `${window.location.origin}/auth`,
    });
    if (error) toast.error("Could not send the reset link");
    else toast.success("Password reset link sent");
  }

  async function shareApp() {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Reezap", url });
        return;
      } catch {
        /* user cancelled */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Link copied");
  }

  async function unblock(id: string) {
    await supabase.from("blocks").delete().eq("blocker_id", user!.id).eq("blocked_id", id);
    void qc.invalidateQueries({ queryKey: ["blocked", user?.id] });
  }

  return (
    <AppShell>
      <TopBar title="Settings" />
      <div className="space-y-6 p-4">
        <section className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          <Link to="/edit-profile" className="flex items-center gap-3 p-4 text-sm font-semibold">
            <UserPen className="size-4 text-primary" />
            Edit profile
            <ChevronRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
          <Link to="/saved" className="flex items-center gap-3 p-4 text-sm font-semibold">
            <Bookmark className="size-4 text-primary" />
            Saved listings
            <ChevronRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
          {profile?.is_verified ? (
            <div
              aria-disabled="true"
              className="pointer-events-none flex items-center gap-3 p-4 text-sm font-semibold opacity-50"
            >
              <BadgeCheck className="size-4 text-primary" />
              Your account is verified.
            </div>
          ) : (
            <Link to="/edit-profile" className="flex items-center gap-3 p-4 text-sm font-semibold">
              <BadgeCheck className="size-4 text-primary" />
              Get verified
              <ChevronRight className="ml-auto size-4 text-muted-foreground" />
            </Link>
          )}

          <Link to="/premium" className="flex items-center gap-3 p-4 text-sm font-semibold">
            <Crown className="size-4 text-primary" />
            {profile?.is_premium ? "Manage premium" : "Go premium"}
            <ChevronRight className="ml-auto size-4 text-muted-foreground" />
          </Link>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="font-bold">Preferences</h2>
          <div className="space-y-1.5">
            <Label>Language</Label>
            <Select
              value={lang}
              onValueChange={(v) => {
                setLang(v as "en" | "fr");
                void patch({ language: v });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="fr">Français</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">New follower alerts</p>
              <p className="text-xs text-muted-foreground">Get notified when someone follows you.</p>
            </div>
            <Switch
              checked={profile?.notify_follows ?? true}
              disabled={saving}
              onCheckedChange={(v) => void patch({ notify_follows: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Like alerts</p>
              <p className="text-xs text-muted-foreground">
                Know when someone likes one of your listings.
              </p>
            </div>
            <Switch
              checked={profile?.notify_likes ?? true}
              disabled={saving}
              onCheckedChange={(v) => void patch({ notify_likes: v })}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Moderation updates</p>
              <p className="text-xs text-muted-foreground">
                Verification decisions and report outcomes.
              </p>
            </div>
            <Switch
              checked={profile?.notify_moderation ?? true}
              disabled={saving}
              onCheckedChange={(v) => void patch({ notify_moderation: v })}
            />
          </div>
        </section>

        <section className="space-y-4 rounded-xl border border-border bg-surface p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <KeyRound className="size-4 text-primary" /> Account
          </h2>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Change password</p>
              <p className="text-xs text-muted-foreground">
                We'll email you a secure reset link.
              </p>
            </div>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={sendResetLink}>
              Send link
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Share Reezap</p>
              <p className="text-xs text-muted-foreground">
                Invite a vendor or a friend to the app.
              </p>
            </div>
            <Button size="sm" variant="secondary" className="rounded-full" onClick={shareApp}>
              <Share2 className="mr-1.5 size-4" /> Share
            </Button>
          </div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold">Sign out everywhere</p>
              <p className="text-xs text-muted-foreground">
                Ends your session on every device.
              </p>
            </div>
            <Button
              size="sm"
              variant="secondary"
              className="rounded-full"
              onClick={async () => {
                await supabase.auth.signOut({ scope: "global" });
                void navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          </div>
          <div className="space-y-2 border-t border-border pt-4">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ShieldOff className="size-4 text-primary" /> Blocked accounts
            </p>
            {!blocked?.length && (
              <p className="text-xs text-muted-foreground">You haven't blocked anyone.</p>
            )}
            {blocked?.map((b) => (
              <div key={b.blocked_id} className="flex items-center justify-between gap-3">
                <span className="truncate text-sm">
                  {b.profiles?.display_name ?? b.profiles?.username ?? "Someone"}
                </span>
                <button
                  onClick={() => void unblock(b.blocked_id)}
                  className="text-xs font-semibold text-primary"
                >
                  Unblock
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-xl border border-border bg-surface p-4">
          <h2 className="mb-2 flex items-center gap-2 font-bold">
            <Lock className="size-4 text-primary" /> Privacy & safety
          </h2>
          <Accordion type="single" collapsible>
            <AccordionItem value="privacy">
              <AccordionTrigger className="text-sm">Privacy policy</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Reezap stores only what's needed to run the marketplace: your account details,
                  listings, location at town and neighborhood level, and your WhatsApp number so
                  buyers can reach you.
                </p>
                <p>
                  GPS data is stripped from every photo before upload. ID documents are stored in a
                  private bucket and seen only by our review team.
                </p>
                <p>
                  Reezap never handles payments and never sells your data. Deleting a listing removes
                  it from the timeline immediately.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="terms">
              <AccordionTrigger className="text-sm">Community rules</AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Post only real products and services you can deliver. No scams, counterfeit goods,
                  weapons, drugs or adult content.
                </p>
                <p>
                  Meet in public places, check goods before paying, and report anything suspicious —
                  our team reviews every report.
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="support">
              <AccordionTrigger className="flex text-sm">
                <span className="flex items-center gap-2">
                  <LifeBuoy className="size-4 text-primary" /> Support
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Need help with your account, a listing or a buyer? Reach the Reezap team:</p>
                <a
                  href={SUPPORT_WHATSAPP}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-semibold text-primary"
                >
                  Chat with support on WhatsApp
                </a>
                <a href="mailto:support@reezap.com" className="block font-semibold text-primary">
                  support@reezap.com
                </a>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="about">
              <AccordionTrigger className="flex text-sm">
                <span className="flex items-center gap-2">
                  <Info className="size-4 text-primary" /> About
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Reezap — local discovery and WhatsApp ordering for the South West Region.</p>
                <p>
                  App version <span data-no-translate>{APP_VERSION}</span>
                </p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="delete">
              <AccordionTrigger className="flex text-sm">
                <span className="flex items-center gap-2">
                  <Trash2 className="size-4 text-destructive" /> Delete my account
                </span>
              </AccordionTrigger>
              <AccordionContent className="space-y-2 text-sm text-muted-foreground">
                <p>Our team removes your account and listings within 48 hours.</p>
                <a
                  href={`https://wa.me/237600000000?text=${encodeURIComponent(
                    "Hello Reezap, please delete my account.",
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block font-semibold text-destructive"
                >
                  Request account deletion
                </a>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
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
