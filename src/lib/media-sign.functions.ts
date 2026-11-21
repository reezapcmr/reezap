import { createServerFn } from "@tanstack/react-start";

type Input = { bucket: "listing-media" | "avatars"; paths: string[] };

/**
 * Storage buckets have no public read rule, so media is signed here.
 * Only paths that belong to a published listing or a profile avatar are signed.
 */
export const signMedia = createServerFn({ method: "POST" })
  .inputValidator((data: Input) => {
    if (data.bucket !== "listing-media" && data.bucket !== "avatars") throw new Error("Invalid bucket");
    if (!Array.isArray(data.paths) || data.paths.length > 100) throw new Error("Invalid paths");
    const paths = data.paths.filter(
      (p) => typeof p === "string" && p.length < 300 && /^[A-Za-z0-9/_.\-]+$/.test(p) && !p.includes(".."),
    );
    return { bucket: data.bucket, paths: [...new Set(paths)] };
  })
  .handler(async ({ data }) => {
    if (!data.paths.length) return [] as { path: string; signedUrl: string | null }[];
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const allowed = new Set<string>();
    if (data.bucket === "avatars") {
      const { data: rows } = await supabaseAdmin.from("profiles").select("avatar_url").in("avatar_url", data.paths);
      for (const r of rows ?? []) if (r.avatar_url) allowed.add(r.avatar_url);
    } else {
      const [{ data: a }, { data: b }, { data: c }] = await Promise.all([
        supabaseAdmin.from("listings").select("media_urls").overlaps("media_urls", data.paths),
        supabaseAdmin.from("listings").select("media_url").in("media_url", data.paths),
        supabaseAdmin.from("listings").select("voice_note_url").in("voice_note_url", data.paths),
      ]);
      for (const r of a ?? []) for (const p of r.media_urls ?? []) allowed.add(p);
      for (const r of b ?? []) if (r.media_url) allowed.add(r.media_url);
      for (const r of c ?? []) if (r.voice_note_url) allowed.add(r.voice_note_url);
    }
    const ok = data.paths.filter((p) => allowed.has(p));
    if (!ok.length) return [];
    const { data: signed } = await supabaseAdmin.storage.from(data.bucket).createSignedUrls(ok, 3600);
    return (signed ?? []).map((s) => ({ path: s.path ?? "", signedUrl: s.signedUrl ?? null }));
  });
