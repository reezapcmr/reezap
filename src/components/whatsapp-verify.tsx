import { useEffect, useState } from "react";
import { BadgeCheck, Loader2, MessageCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizePhone, REEZAP_WHATSAPP_NUMBER, whatsappVerifyLink } from "@/lib/reezap";
import { useAuth } from "@/hooks/use-auth";

type Pending = { code: string; expiresAt: string };

/**
 * Free WhatsApp-based phone verification: we hand the user a 6-digit code and
 * a pre-filled wa.me link to the Reezap number. An inbound webhook matches the
 * code and stamps `phone_verified_at` on their profile.
 */
export function WhatsAppVerify({ userId, defaultPhone }: { userId: string; defaultPhone?: string }) {
  const { profile, refreshProfile } = useAuth();
  const [phone, setPhone] = useState(defaultPhone ?? "");
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const verified = !!profile?.phone_verified_at;

  // While a code is outstanding, poll for the webhook confirmation.
  useEffect(() => {
    if (!pending || verified) return;
    const timer = setInterval(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("phone_verified_at")
        .eq("id", userId)
        .maybeSingle();
      if (data?.phone_verified_at) {
        clearInterval(timer);
        setPending(null);
        await refreshProfile();
        toast.success("WhatsApp number verified — your badge is live");
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [pending, verified, userId, refreshProfile]);

  async function requestCode() {
    const normalized = normalizePhone(phone);
    if (!normalized) {
      toast.error("Enter a valid Cameroon WhatsApp number, e.g. 6 70 00 00 00");
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await supabase.rpc("start_phone_verification", {
        p_phone: normalized,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.code) throw new Error("Could not start verification");
      setPending({ code: row.code, expiresAt: row.expires_at });
      await refreshProfile();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not start verification";
      toast.error(
        message.includes("too_many_attempts")
          ? "Too many attempts — try again in a few minutes"
          : message.includes("invalid_phone")
            ? "Enter a valid Cameroon WhatsApp number"
            : message,
      );
    } finally {
      setBusy(false);
    }
  }

  if (verified) {
    return (
      <p className="flex items-center gap-2 text-sm text-primary">
        <BadgeCheck className="size-4" /> Your WhatsApp number is verified.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Verify your WhatsApp number to earn the trust badge. It is free — you just send us one
        message. Browsing, posting and chatting work either way.
      </p>

      {!pending ? (
        <>
          <div className="space-y-1.5">
            <Label htmlFor="verify-phone">WhatsApp number</Label>
            <Input
              id="verify-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="6 70 00 00 00"
            />
          </div>
          <Button onClick={requestCode} disabled={busy} className="w-full rounded-full font-bold">
            {busy ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : (
              <MessageCircle className="mr-2 size-4" />
            )}
            Verify on WhatsApp
          </Button>
        </>
      ) : (
        <>
          <div className="rounded-xl border border-border bg-secondary/40 p-4 text-center">
            <p className="text-xs text-muted-foreground">Your code (valid 10 minutes)</p>
            <p className="mt-1 text-2xl font-extrabold tracking-[0.3em]">{pending.code}</p>
          </div>
          <a
            href={whatsappVerifyLink(pending.code)}
            target="_blank"
            rel="noreferrer"
            className="block"
          >
            <Button className="w-full rounded-full font-bold">
              <MessageCircle className="mr-2 size-4" /> Send code on WhatsApp
            </Button>
          </a>
          <p className="text-xs text-muted-foreground">
            Tap the button, then press send in WhatsApp. We check for your message automatically —
            our number is {REEZAP_WHATSAPP_NUMBER}.
          </p>
          <Button
            variant="ghost"
            onClick={() => setPending(null)}
            className="w-full rounded-full text-xs"
          >
            <RefreshCw className="mr-2 size-3.5" /> Use a different number
          </Button>
        </>
      )}
    </div>
  );
}
