import { formatPrice } from "@/lib/reezap";

type FlyerInput = {
  title: string;
  price: number | null;
  place: string | null;
  vendor: string | null;
  imageUrl: string | null;
  url: string;
};

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = w;
    } else line = test;
  }
  if (line) lines.push(line);
  if (lines.length > maxLines) {
    lines.length = maxLines;
    lines[maxLines - 1] = `${lines[maxLines - 1]!.replace(/\s+\S*$/, "")}…`;
  }
  return lines;
}

/** Draws a 1080x1920 WhatsApp Status flyer for a listing and returns it as a PNG. */
export async function makeStatusFlyer(input: FlyerInput): Promise<Blob> {
  const W = 1080;
  const H = 1920;
  const lime = "#D7FF00";
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  try {
    await document.fonts.load("800 64px 'Plus Jakarta Sans'");
  } catch {
    /* fall back to system font */
  }
  const font = (w: number, size: number) => `${w} ${size}px 'Plus Jakarta Sans', sans-serif`;

  ctx.fillStyle = "#0B0B0B";
  ctx.fillRect(0, 0, W, H);

  // Wordmark
  ctx.fillStyle = lime;
  ctx.font = font(800, 64);
  ctx.fillText("REEZAP", 80, 150);

  // Photo
  const photoY = 220;
  const photoH = 1000;
  const img = input.imageUrl ? await loadImage(input.imageUrl) : null;
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(80, photoY, W - 160, photoH, 48);
  ctx.clip();
  if (img) {
    const scale = Math.max((W - 160) / img.width, photoH / img.height);
    const dw = img.width * scale;
    const dh = img.height * scale;
    ctx.drawImage(img, 80 + (W - 160 - dw) / 2, photoY + (photoH - dh) / 2, dw, dh);
  } else {
    ctx.fillStyle = "#1A1A1A";
    ctx.fillRect(80, photoY, W - 160, photoH);
  }
  ctx.restore();

  // Price tag
  if (input.price != null) {
    const label = formatPrice(input.price);
    ctx.font = font(800, 60);
    const tw = ctx.measureText(label).width + 80;
    ctx.fillStyle = lime;
    ctx.beginPath();
    ctx.roundRect(120, photoY + photoH - 140, tw, 100, 50);
    ctx.fill();
    ctx.fillStyle = "#0B0B0B";
    ctx.fillText(label, 160, photoY + photoH - 68);
  }

  // Title
  ctx.fillStyle = "#FFFFFF";
  ctx.font = font(800, 72);
  let y = photoY + photoH + 120;
  for (const l of wrap(ctx, input.title, W - 160, 2)) {
    ctx.fillText(l, 80, y);
    y += 88;
  }

  // Place / vendor
  ctx.font = font(600, 44);
  ctx.fillStyle = "#A3A3A3";
  const meta = [input.place ? `📍 ${input.place}` : null, input.vendor ? `by ${input.vendor}` : null]
    .filter(Boolean)
    .join("  ·  ");
  if (meta) {
    ctx.fillText(meta, 80, y + 10);
    y += 70;
  }

  // CTA
  ctx.fillStyle = lime;
  ctx.beginPath();
  ctx.roundRect(80, H - 300, W - 160, 140, 70);
  ctx.fill();
  ctx.fillStyle = "#0B0B0B";
  ctx.font = font(800, 52);
  const cta = "Order on Reezap";
  ctx.fillText(cta, (W - ctx.measureText(cta).width) / 2, H - 212);

  ctx.fillStyle = "#A3A3A3";
  ctx.font = font(600, 36);
  const link = input.url.replace(/^https?:\/\//, "");
  ctx.fillText(link, (W - ctx.measureText(link).width) / 2, H - 90);

  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create flyer"))), "image/png"),
  );
}

/** Shares the flyer image (so it can be posted to WhatsApp Status) or downloads it. */
export async function shareOrDownloadFlyer(blob: Blob, name: string, text: string) {
  const file = new File([blob], `${name}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text });
      return "shared" as const;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled" as const;
    }
  }
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return "downloaded" as const;
}
