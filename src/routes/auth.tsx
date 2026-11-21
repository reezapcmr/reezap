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
import { Eye, EyeOff, Loader2 } from "lucide-react";
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
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleForgotPassword() {
    const target = email.trim();
    if (!target) {
      toast.error("Enter your email first, then tap “Forgot password?”");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(target, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Password reset link sent — check your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reset link");
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    const dest = safeNext(next);
    try {
      sessionStorage.setItem("reezap_post_auth", dest);
    } catch {
      /* ignore */
    }
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      toast.error("Could not sign in with Google");
      return;
    }
    if (result.redirected) return;
    sessionStorage.removeItem("reezap_post_auth");
    void navigate({ to: dest });
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
        const { data: available } = await supabase.rpc("is_username_available", {
          p_username: handle,
        });
        if (available === false) {
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
          style={{ background: "#131314", color: "#E3E3E3", border: "1px solid #8E918F" }}
        >
          <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#4285F4" d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.560-5.17 3.56-8.82z"/><path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.110-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"/><path fill="#FBBC05" d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"/><path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"/></svg>
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              {mode === "signin" && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs font-semibold text-primary"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                required
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted-foreground"
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
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
