"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import QrScannerLib from "qr-scanner";
import { Icon } from "@/components/ui/Icon";

export type ScanOutcome = { ok: true; message?: string } | { ok: false; message: string };

type Phase = "starting" | "scanning" | "verifying" | "success" | "error" | "denied" | "nocamera";

interface Props {
  /** Verify a scanned payload. The scanner pauses while this runs, so one scan = one request. */
  onScan: (payload: string) => Promise<ScanOutcome>;
  idleHint?: string;
}

/**
 * Camera QR scanner. States: starting → scanning → verifying → success | error.
 * Handles permission denial, camera switching, duplicate scans and an image-upload fallback.
 */
export function QrScanner({ onScan, idleHint = "Position your Smart ID card inside the scanning area." }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const busy = useRef(false);
  const lastPayload = useRef<{ v: string; t: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("starting");
  const [message, setMessage] = useState("");
  const [cameras, setCameras] = useState<QrScannerLib.Camera[]>([]);
  const [camIdx, setCamIdx] = useState(0);

  const handle = useCallback(
    async (payload: string) => {
      if (busy.current) return; // duplicate-scan guard
      const prev = lastPayload.current;
      if (prev && prev.v === payload && Date.now() - prev.t < 4000) return;
      busy.current = true;
      lastPayload.current = { v: payload, t: Date.now() };
      scannerRef.current?.pause();
      setPhase("verifying");
      setMessage("Verifying your identity…");
      try {
        const r = await onScan(payload);
        if (r.ok) {
          setPhase("success");
          setMessage(r.message ?? "Authentication successful.");
          return; // stay locked; the caller navigates away
        }
        setPhase("error");
        setMessage(r.message);
      } catch {
        setPhase("error");
        setMessage("Network error. Check your connection and try again.");
      }
      busy.current = false;
    },
    [onScan],
  );

  useEffect(() => {
    let cancelled = false;
    const video = videoRef.current;
    if (!video) return;

    (async () => {
      if (!(await QrScannerLib.hasCamera())) {
        if (!cancelled) {
          setPhase("nocamera");
          setMessage("No camera was found on this device.");
        }
        return;
      }
      const scanner = new QrScannerLib(video, (res) => void handle(res.data), {
        preferredCamera: "environment",
        highlightScanRegion: true,
        highlightCodeOutline: true,
        maxScansPerSecond: 8,
      });
      scannerRef.current = scanner;
      try {
        await scanner.start();
        if (cancelled) return scanner.destroy();
        setCameras(await QrScannerLib.listCameras(true));
        setPhase("scanning");
        setMessage(idleHint);
      } catch (e) {
        if (cancelled) return;
        const denied = e instanceof Error && /permission|denied|NotAllowed/i.test(`${e.name} ${e.message}`);
        setPhase(denied ? "denied" : "nocamera");
        setMessage(denied ? "Camera access was blocked. Allow the camera for this site, then retry." : "The camera could not be started.");
      }
    })();

    return () => {
      cancelled = true;
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, [handle, idleHint]);

  const retry = async () => {
    lastPayload.current = null;
    busy.current = false;
    setMessage(idleHint);
    if (scannerRef.current && (phase === "error" || phase === "scanning")) {
      setPhase("scanning");
      await scannerRef.current.start().catch(() => null);
    } else {
      window.location.reload();
    }
  };

  const switchCamera = async () => {
    if (cameras.length < 2 || !scannerRef.current) return;
    const next = (camIdx + 1) % cameras.length;
    setCamIdx(next);
    await scannerRef.current.setCamera(cameras[next].id).catch(() => null);
  };

  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const r = await QrScannerLib.scanImage(file, { returnDetailedScanResult: true });
      await handle(r.data);
    } catch {
      setPhase("error");
      setMessage("No QR code was found in that image.");
    }
  };

  const tone = phase === "success" ? "ok" : phase === "error" || phase === "denied" || phase === "nocamera" ? "bad" : "info";
  const canRetry = phase === "error" || phase === "denied" || phase === "nocamera";

  return (
    <div className="cd-card" style={{ overflow: "hidden" }}>
      <div style={{ position: "relative", background: "#000", aspectRatio: "4 / 3" }}>
        <video ref={videoRef} aria-label="Camera preview for scanning your Smart ID card" playsInline muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        {phase === "scanning" && <div className="c35-scan-line" aria-hidden="true" />}
        {(phase === "verifying" || phase === "success") && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", background: "rgba(0,0,0,.55)", color: "#fff" }}>
            <Icon name={phase === "success" ? "done" : "loader"} size={56} />
          </div>
        )}
      </div>

      <div className="cd-card-body" style={{ display: "grid", gap: 12 }}>
        <p role="status" aria-live="polite" className={`cd-banner`} data-tone={tone === "bad" ? "bad" : tone === "ok" ? "ok" : undefined} style={{ margin: 0 }}>
          {phase === "starting" ? "Starting camera…" : message}
        </p>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {canRetry && (
            <button type="button" className="ds-btn sm" onClick={retry}>
              <Icon name="refresh" size={16} /> Try again
            </button>
          )}
          {cameras.length > 1 && (
            <button type="button" className="ds-btn outline sm" onClick={switchCamera}>
              <Icon name="camera" size={16} /> Switch camera
            </button>
          )}
          <button type="button" className="ds-btn outline sm" onClick={() => fileRef.current?.click()}>
            <Icon name="image" size={16} /> Upload card image
          </button>
          <input ref={fileRef} aria-label="Upload a photo of your Smart ID card" type="file" accept="image/*" hidden onChange={(e) => void onFile(e.target.files?.[0])} />
        </div>
      </div>

      <style>{`
        .c35-scan-line{position:absolute;left:12%;right:12%;top:20%;height:2px;background:var(--md-primary);box-shadow:0 0 12px var(--md-primary);animation:c35scan 2.2s ease-in-out infinite alternate}
        @keyframes c35scan{to{top:78%}}
        @media (prefers-reduced-motion: reduce){.c35-scan-line{animation:none}}
      `}</style>
    </div>
  );
}
