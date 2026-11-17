"use client";

/**
 * Browser side of device enrollment. The private key is generated as NON-EXTRACTABLE and kept
 * in IndexedDB, so it can sign challenges but can never be read out by page scripts.
 * (A browser still cannot prove it is the *hardware* the admin handed out; managed-browser /
 * MDM attestation is the stronger layer — see docs/AUTHENTICATION.md.)
 */
const DB = "c35-device";
const STORE = "kv";

interface StoredDevice {
  deviceId: string;
  privateKey: CryptoKey;
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function get(): Promise<StoredDevice | null> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const r = db.transaction(STORE).objectStore(STORE).get("device");
    r.onsuccess = () => resolve((r.result as StoredDevice) ?? null);
    r.onerror = () => reject(r.error);
  });
}

async function put(v: StoredDevice): Promise<void> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(v, "device");
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function hasEnrolledDevice(): Promise<boolean> {
  try {
    return (await get()) !== null;
  } catch {
    return false;
  }
}

export async function enrollThisDevice(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, false, ["sign", "verify"]);
  const jwk = await crypto.subtle.exportKey("jwk", pair.publicKey);
  const res = await fetch("/api/devices/enroll", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code: code.trim(), publicKeyJwk: { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y } }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: data.error ?? "Enrollment failed" };
  await put({ deviceId: data.deviceId, privateKey: pair.privateKey });
  return { ok: true };
}

function toBase64(buf: ArrayBuffer): string {
  let s = "";
  for (const b of new Uint8Array(buf)) s += String.fromCharCode(b);
  return btoa(s);
}

/** Fetch a server nonce and sign it. Returns undefined when this browser has no enrolled device. */
export async function proveDevice(): Promise<{ id: string; nonce: string; signature: string } | undefined> {
  const dev = await get().catch(() => null);
  if (!dev) return undefined;
  const res = await fetch("/api/devices/challenge", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: dev.deviceId }),
  });
  if (!res.ok) return undefined;
  const { nonce } = (await res.json()) as { nonce: string };
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, dev.privateKey, new TextEncoder().encode(nonce));
  return { id: dev.deviceId, nonce, signature: toBase64(sig) };
}
