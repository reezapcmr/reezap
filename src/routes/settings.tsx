import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ChevronRight,
  Crown,
  LifeBuoy,
  Lock,
  LogOut,
  UserPen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
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

function SettingsPage() {
  const { user, profile, loading, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth", search: { next: "/settings" } });
  }, [loading, user, navigate]);

  async function patch(values: Record<string, unknown>) {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(values).eq("id", user.id);
    setSaving(false);
    if (error) toast.error("Could not save your preference");
    else await refreshProfile();
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
              value={profile?.language ?? "en"}
              onValueChange={(v) => void patch({ language: v })}
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
                  href="https://wa.me/237600000000?text=Hello%20Reezap%20support"
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
