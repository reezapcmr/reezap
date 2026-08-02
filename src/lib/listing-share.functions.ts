import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type ListingPreview = {
  id: string;
  title: string;
  description: string | null;
  price: number | null;
  vendor: string | null;
  town: string | null;
  image: string | null;
} | null;

/**
 * Public, unauthenticated preview used to build shareable link metadata
 * (OpenGraph / Twitter cards) when a listing URL is pasted on WhatsApp,
 * Facebook, X, etc. Only safe, already-public columns are returned.
 */
export const getListingPreview = createServerFn({ method: "GET" })
  .inputValidator((data: { id: string }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.id)) throw new Error("Invalid listing id");
    return data;
  })
  .handler(async ({ data }): Promise<ListingPreview> => {
    const url = process.env["SUPABASE_URL"];
    const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!url || !key) return null;

    const supabasePublic = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
      global: {
        fetch: (input, init) => {
          const headers = new Headers(init?.headers);
          if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
            headers.delete("Authorization");
          }
          headers.set("apikey", key);
          return fetch(input, { ...init, headers });
        },
      },
    });

    const { data: row } = await supabasePublic
      .from("listings")
      .select(
        "id,title,description,price,media_url,media_urls,towns(name),profiles!listings_vendor_id_fkey(display_name,username)",
      )
      .eq("id", data.id)
      .maybeSingle();

    if (!row) return null;

    const path = (row.media_urls ?? []).filter(Boolean)[0] ?? row.media_url ?? null;
    let image: string | null = null;
    if (path) {
      if (path.startsWith("http")) {
        image = path;
      } else if (path.startsWith("/")) {
        image = `https://reezap.lovable.app${path}`;
      } else {
        // Media lives in a private bucket, so social crawlers need a signed URL.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: signed } = await supabaseAdmin.storage
          .from("listing-media")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        image = signed?.signedUrl ?? null;
      }
    }

    const vendorRow = row.profiles as { display_name: string | null; username: string } | null;

    return {
      id: row.id,
      title: row.title,
      description: row.description,
      price: row.price,
      vendor: vendorRow ? (vendorRow.display_name ?? vendorRow.username) : null,
      town: (row.towns as { name: string } | null)?.name ?? null,
      image,
    };
  });
