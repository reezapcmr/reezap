import { createFileRoute, Link } from "@tanstack/react-router";
import { Check, Crown } from "lucide-react";
import { AppShell, TopBar } from "@/components/app-shell";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { FREE_DAILY_POST_LIMIT, MAX_LISTING_PHOTOS } from "@/lib/reezap";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "Reezap Premium — post more, stay on top" },
      {
        name: "description",
        content:
          "Premium vendors post unlimited listings, pin posts to the top of the timeline and stay live for 7 days instead of 48 hours.",
      },
      { property: "og:title", content: "Reezap Premium — post more, stay on top" },
      {
        property: "og:description",
        content: "Unlimited daily posts, pinned listings and 7-day visibility for Reezap vendors.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PremiumPage,
});

const perks = [
  `Unlimited daily posts (free accounts get ${FREE_DAILY_POST_LIMIT})`,
  "Pin listings to the top of the timeline",
  "Listings stay live 7 days instead of 48 hours",
  `Up to ${MAX_LISTING_PHOTOS} photos with priority placement in search`,
  "Premium badge on your vendor profile",
];

function PremiumPage() {
  const { profile } = useAuth();
  const active =
    !!profile?.is_premium &&
    (!profile.premium_until || new Date(profile.premium_until).getTime() > Date.now());

  return (
    <AppShell>
      <TopBar title="Premium" />
      <div className="space-y-6 p-4">
        <section className="rounded-2xl border border-primary/40 bg-surface p-5">
          <Crown className="size-7 text-primary" />
          <h1 className="mt-3 text-2xl font-extrabold">Reezap Premium</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            For vendors who sell every day and want their goods seen first.
          </p>
          <p className="mt-4 text-3xl font-extrabold text-primary">
            2 000 FCFA <span className="text-sm font-semibold text-muted-foreground">/ month</span>
          </p>
        </section>

        <ul className="space-y-3">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-3 text-sm">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              {p}
            </li>
          ))}
        </ul>

        {active ? (
          <div className="rounded-xl border border-border bg-surface p-4 text-sm">
            <p className="font-bold text-primary">Premium is active</p>
            {profile?.premium_until && (
              <p className="text-muted-foreground">
                Renews on {new Date(profile.premium_until).toLocaleDateString()}.
              </p>
            )}
          </div>
        ) : (
          <>
            <Button asChild className="w-full rounded-full py-6 font-bold">
              <a
                href="https://wa.me/237600000000?text=Hello%20Reezap%2C%20I%20want%20to%20activate%20Premium"
                target="_blank"
                rel="noopener noreferrer"
              >
                Activate on WhatsApp
              </a>
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Pay with MTN MoMo or Orange Money — our team activates your account within minutes.
            </p>
          </>
        )}

        <Link to="/profile" className="block text-center text-sm text-muted-foreground underline">
          Back to your profile
        </Link>
      </div>
    </AppShell>
  );
}
