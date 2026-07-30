import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/logo";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { normalizePhone } from "@/lib/reezap";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in to Reezap" },
      {
        name: "description",
        content: "Create your Reezap account to follow vendors, save listings and start selling.",
      },
      { property: "og:title", content: "Sign in to Reezap" },
      {
        property: "og:description",
        content: "Join Reezap to discover and sell in Cameroon's South West Region.",
      },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : undefined,
  }),
  component: AuthPage,
});

function safeNext(next?: string) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

function AuthPage() {
  const navigate = useNavigate();
  const { next } = useSearch({ from: "/auth" });
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [phone, setPhone] = useState("");
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}${safeNext(next)}`,
    });
    if (result.error) {
      toast.error("Could not sign in with Google");
      return;
    }
    if (result.redirected) return;
    void navigate({ to: safeNext(next) });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        if (!agree) {
          toast.error("Please accept the terms to continue");
          return;
        }
        const handle = username.trim().toLowerCase();
        if (!/^[a-z0-9_]{3,20}$/.test(handle)) {
          toast.error("Username must be 3–20 letters, numbers or underscores");
          return;
        }
        const normalizedPhone = normalizePhone(phone);
        if (!normalizedPhone) {
          toast.error("Enter a valid Cameroon WhatsApp number, e.g. 6 70 00 00 00");
          return;
        }
        const { data: taken } = await supabase
          .from("profiles")
          .select("id")
          .eq("username", handle)
          .maybeSingle();
        if (taken) {
          toast.error("That username is already taken");
          return;
        }
        const { data: signed, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}${safeNext(next)}`,
            data: { username: handle, display_name: displayName || handle },
          },
        });
        if (error) throw error;
        if (signed.user) {
          // The signup trigger creates the profile; attach the phone number to it.
          await supabase
            .from("profiles")
            .update({ whatsapp: normalizedPhone })
            .eq("id", signed.user.id);
        }
        toast.success("Account created — welcome to Reezap!");
        void navigate({ to: safeNext(next) });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        void navigate({ to: safeNext(next) });
      }

    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center">
          <Logo size={44} />
        </div>
        <h1 className="mt-8 text-center text-2xl font-extrabold">
          {mode === "signin" ? "Welcome back" : "Join Reezap"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          Discover vendors near you and order on WhatsApp.
        </p>

        <Button
          type="button"
          variant="secondary"
          className="mt-7 w-full rounded-full py-6 font-semibold"
          onClick={handleGoogle}
        >
          Continue with Google
        </Button>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="mamanjoy"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="display">Display name</Label>
                <Input
                  id="display"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Maman Joy"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">WhatsApp number</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="6 70 00 00 00"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Buyers reach you here — we save it as +237 and never show it publicly.
                </p>
              </div>
            </>

          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
            />
          </div>

          {mode === "signup" && (
            <label className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <Checkbox
                checked={agree}
                onCheckedChange={(v) => setAgree(v === true)}
                className="mt-0.5"
              />
              <span>
                I agree to the Reezap terms and understand Reezap is a discovery platform — all
                deals happen directly between buyer and vendor.
              </span>
            </label>
          )}

          <Button type="submit" disabled={busy} className="w-full rounded-full py-6 font-bold">
            {busy && <Loader2 className="mr-2 size-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "New to Reezap?" : "Already have an account?"}{" "}
          <button
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="font-semibold text-primary"
          >
            {mode === "signin" ? "Create an account" : "Sign in"}
          </button>
        </p>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/">Continue browsing without an account</Link>
        </p>
      </div>
    </div>
  );
}
