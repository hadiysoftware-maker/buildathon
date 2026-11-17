import "server-only";

/**
 * Online image search for documents and slides. Only Pexels and Unsplash are used, through server-side keys.
 * The model never supplies a URL we trust: every image URL is checked against a fixed host list before it is fetched.
 */
export interface FoundImage { id: string; url: string; thumb: string; width: number; height: number; credit: string; pageUrl: string; source: "pexels" | "unsplash"; alt: string }

const HOSTS = new Set(["images.pexels.com", "images.unsplash.com"]);
const MAX_BYTES = 5 * 1024 * 1024;

export const imageSearchConfigured = () => !!(process.env.PEXELS_API_KEY || process.env.UNSPLASH_ACCESS_KEY);

export function isAllowedImageUrl(u: string): boolean {
  try {
    const x = new URL(u);
    return x.protocol === "https:" && HOSTS.has(x.hostname);
  } catch {
    return false;
  }
}

async function pexels(query: string, count: number): Promise<FoundImage[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`, { headers: { Authorization: key }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { photos?: { id: number; width: number; height: number; url: string; photographer: string; alt?: string; src: { large: string; medium: string } }[] };
  return (j.photos ?? []).map((p) => ({ id: `pexels-${p.id}`, url: p.src.large, thumb: p.src.medium, width: p.width, height: p.height, credit: `Photo by ${p.photographer} on Pexels`, pageUrl: p.url, source: "pexels" as const, alt: p.alt ?? query }));
}

async function unsplash(query: string, count: number): Promise<FoundImage[]> {
  const key = process.env.UNSPLASH_ACCESS_KEY;
  if (!key) return [];
  const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${count}&orientation=landscape`, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(8000) });
  if (!r.ok) return [];
  const j = (await r.json()) as { results?: { id: string; width: number; height: number; alt_description?: string; links: { html: string }; user: { name: string }; urls: { regular: string; small: string } }[] };
  return (j.results ?? []).map((p) => ({ id: `unsplash-${p.id}`, url: p.urls.regular, thumb: p.urls.small, width: p.width, height: p.height, credit: `Photo by ${p.user.name} on Unsplash`, pageUrl: p.links.html, source: "unsplash" as const, alt: p.alt_description ?? query }));
}

export async function searchImages(query: string, count = 4): Promise<FoundImage[]> {
  const n = Math.min(Math.max(count, 1), 8);
  const q = query.trim().slice(0, 100);
  if (!q) return [];
  const first = await pexels(q, n).catch(() => []);
  const rest = first.length >= n ? [] : await unsplash(q, n - first.length).catch(() => []);
  return [...first, ...rest].filter((i) => isAllowedImageUrl(i.url));
}

export interface LoadedImage { bytes: Buffer; mime: "image/jpeg" | "image/png"; width: number; height: number }

/** Downloads an allow-listed image with a size cap and reads its dimensions from the file header. */
export async function loadImage(url: string): Promise<LoadedImage | null> {
  if (!isAllowedImageUrl(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(10_000), redirect: "error" });
    if (!r.ok) return null;
    const len = Number(r.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return null;
    const bytes = Buffer.from(await r.arrayBuffer());
    if (bytes.length > MAX_BYTES) return null;
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return { bytes, mime: "image/png", width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
    if (bytes[0] === 0xff && bytes[1] === 0xd8) {
      let i = 2;
      while (i < bytes.length - 9) {
        if (bytes[i] !== 0xff) { i++; continue; }
        const m = bytes[i + 1];
        if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) return { bytes, mime: "image/jpeg", height: bytes.readUInt16BE(i + 5), width: bytes.readUInt16BE(i + 7) };
        i += 2 + bytes.readUInt16BE(i + 2);
      }
    }
    return null;
  } catch {
    return null;
  }
}
