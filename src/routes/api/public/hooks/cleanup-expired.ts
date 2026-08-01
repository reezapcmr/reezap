import { createFileRoute } from "@tanstack/react-router";

/**
 * Scheduled cleanup: listings stay visible for 48h, then linger for a short
 * grace period so vendors can repost. After 7 days they are removed from the
 * database and their photos are deleted from the storage bucket.
 * Called by a scheduled job with the project's publishable key.
 */
export const Route = createFileRoute("/api/public/hooks/cleanup-expired")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apikey =
          request.headers.get("apikey") ??
          request.headers.get("authorization")?.replace("Bearer ", "");
        if (!apikey || apikey !== process.env["SUPABASE_PUBLISHABLE_KEY"]) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

        const { data: stale, error } = await supabaseAdmin
          .from("listings")
          .select("id, media_url, media_urls, voice_note_url")
          .lt("expires_at", cutoff)
          .limit(500);

        if (error) {
          return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        const rows = stale ?? [];
        if (!rows.length) {
          return new Response(JSON.stringify({ deleted: 0, files: 0 }), {
            headers: { "Content-Type": "application/json" },
          });
        }

        const isStoragePath = (p: string | null | undefined) =>
          !!p && !p.startsWith("http") && !p.startsWith("/");

        const files = rows
          .flatMap((r) => [r.media_url, ...(r.media_urls ?? []), r.voice_note_url])
          .filter(isStoragePath) as string[];

        if (files.length) {
          await supabaseAdmin.storage.from("listing-media").remove(files);
        }

        const { error: delError } = await supabaseAdmin
          .from("listings")
          .delete()
          .in(
            "id",
            rows.map((r) => r.id),
          );

        if (delError) {
          return new Response(JSON.stringify({ error: delError.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ deleted: rows.length, files: files.length }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
