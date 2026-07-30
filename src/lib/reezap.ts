import { supabase } from "@/integrations/supabase/client";

export type ListingStatus = "in_stock" | "sold_out_today";

/** Columns on `profiles` that unauthenticated visitors are allowed to read. */
export const PROFILE_PUBLIC_COLS =
  "id,username,display_name,avatar_url,bio,town_id,neighborhood_id,is_vendor,is_verified,is_premium,created_at";

export const MAX_LISTING_PHOTOS = 3;
export const MAX_DESCRIPTION_WORDS = 50;
export const FREE_DAILY_POST_LIMIT = 7;

export function wordCount(text: string) {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

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

export function isExpired(expiresAt: string | null | undefined) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() <= Date.now();
}

/** "Expires in 12h" style countdown for live listings. */
export function expiresIn(expiresAt: string | null | undefined) {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  if (h >= 24) return `${Math.floor(h / 24)}d left`;
  if (h >= 1) return `${h}h left`;
  return `${Math.max(1, Math.floor(ms / 60000))}m left`;
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

/**
 * Buckets are private, so every stored object path needs a signed URL.
 * Signed URLs are cached in memory so re-renders and repeated cards don't
 * hammer storage (which previously left images blank once signed in).
 */
const signedCache = new Map<string, { url: string; expires: number }>();

export async function resolveMedia(path: string | null | undefined, bucket = "listing-media") {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("http")) return path;

  const key = `${bucket}:${path}`;
  const hit = signedCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.url;

  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 3600);
  if (error || !data?.signedUrl) return null;
  signedCache.set(key, { url: data.signedUrl, expires: Date.now() + 50 * 60 * 1000 });
  return data.signedUrl;
}

export async function resolveMediaList(paths: (string | null)[], bucket = "listing-media") {
  const urls = await Promise.all(paths.map((p) => resolveMedia(p, bucket)));
  return urls.filter((u): u is string => !!u);
}

/** Normalises a listing's gallery: media_urls first, falling back to media_url. */
export function galleryPaths(listing: {
  media_urls?: string[] | null;
  media_url?: string | null;
}): string[] {
  const list = (listing.media_urls ?? []).filter(Boolean);
  if (list.length) return list.slice(0, MAX_LISTING_PHOTOS);
  return listing.media_url ? [listing.media_url] : [];
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

/** Shared PostgREST projection for feed-style listing cards. */
export const LISTING_SELECT =
  "id,title,description,price,media_url,media_urls,status,created_at,expires_at,is_pinned,view_count,town_id,neighborhood_id,towns(name,division),neighborhoods(name),categories(name,emoji),likes(count),profiles!listings_vendor_id_fkey(id,username,display_name,avatar_url,is_verified)";
