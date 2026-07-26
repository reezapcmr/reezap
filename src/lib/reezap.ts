import { supabase } from "@/integrations/supabase/client";

export type ListingStatus = "in_stock" | "sold_out_today";

export function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

export function isFresh(iso: string) {
  return Date.now() - new Date(iso).getTime() < 7 * 24 * 3600 * 1000;
}

export function formatPrice(price: number | null | undefined) {
  if (price == null) return "Ask price";
  return new Intl.NumberFormat("fr-CM").format(price) + " FCFA";
}

/** Rough proximity display: same neighborhood < same town < same division. */
export function proximityLabel(
  viewer: { town_id?: string | null; neighborhood_id?: string | null } | null,
  target: { town_id?: string | null; neighborhood_id?: string | null },
) {
  if (!viewer?.town_id) return null;
  if (viewer.neighborhood_id && viewer.neighborhood_id === target.neighborhood_id)
    return "under 1 km away";
  if (viewer.town_id === target.town_id) return "about 2–5 km away";
  return "another town";
}

export function whatsappLink(number: string | null | undefined, title: string) {
  const digits = (number ?? "").replace(/[^0-9]/g, "");
  const text = encodeURIComponent(
    `Hello! I saw your listing "${title}" on Reezap. Is it still available?`,
  );
  return `https://wa.me/${digits}?text=${text}`;
}

const SPAM_WORDS = [
  "wire transfer",
  "bitcoin doubling",
  "send money first",
  "western union only",
  "double your money",
  "investment scheme",
  "forex bonus",
  "click this link to win",
];

export function looksLikeSpam(text: string) {
  const lower = text.toLowerCase();
  return SPAM_WORDS.some((w) => lower.includes(w));
}

/** Buckets are private; resolve a displayable URL for a stored object path. */
export async function resolveMedia(path: string | null | undefined, bucket = "listing-media") {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("http")) return path;
  const { data } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}

/** Strips EXIF/GPS by re-encoding the image through a canvas before upload. */
export async function stripExif(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const max = 1600;
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b ?? file), "image/jpeg", 0.85),
  );
}
