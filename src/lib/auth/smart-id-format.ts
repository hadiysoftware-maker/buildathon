/** QR payload: `C35:<credentialId>.<secret>` — opaque, contains no personal data. */
const PREFIX = "C35:";
const RE = /^C35:([a-z0-9]{20,30})\.([A-Za-z0-9_-]{43})$/;

export function encodeCredential(id: string, secret: string): string {
  return `${PREFIX}${id}.${secret}`;
}

export function parseCredential(payload: string): { id: string; secret: string } | null {
  const m = RE.exec(payload.trim());
  return m ? { id: m[1], secret: m[2] } : null;
}
