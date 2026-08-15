import { createFileRoute } from "@tanstack/react-router";

/**
 * Free WhatsApp Cloud API webhook. Meta calls GET once to verify the endpoint,
 * then POSTs every inbound message. We pull the 6-digit code out of the message
 * body and stamp `phone_verified_at` on the matching profile.
 */
export const Route = createFileRoute("/api/public/hooks/whatsapp")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const token = process.env["WHATSAPP_VERIFY_TOKEN"];
        if (
          url.searchParams.get("hub.mode") === "subscribe" &&
          token &&
          url.searchParams.get("hub.verify_token") === token
        ) {
          return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
        }
        return new Response("Forbidden", { status: 403 });
      },

      POST: async ({ request }) => {
        let payload: unknown;
        try {
          payload = await request.json();
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        type Msg = { from?: string; text?: { body?: string } };
        const messages: Msg[] = [];
        const entries = (payload as { entry?: unknown[] })?.entry ?? [];
        for (const entry of entries) {
          for (const change of (entry as { changes?: unknown[] })?.changes ?? []) {
            const value = (change as { value?: { messages?: Msg[] } })?.value;
            for (const m of value?.messages ?? []) messages.push(m);
          }
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        let confirmed = 0;

        for (const m of messages) {
          const code = (m.text?.body ?? "").match(/\b(\d{6})\b/)?.[1];
          if (!code) continue;
          const from = m.from ? `+${m.from.replace(/[^0-9]/g, "")}` : null;
          const { data } = await supabaseAdmin.rpc("confirm_phone_verification", {
            p_code: code,
            p_from_phone: from,
          });
          if (data) confirmed += 1;
        }

        return new Response(JSON.stringify({ received: messages.length, confirmed }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
