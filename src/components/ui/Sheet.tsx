"use client";

import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Icon } from "./Icon";
import { Presence } from "./Presence";

export function Sheet({
  open,
  onClose,
  title,
  size = "md",
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  size?: "sm" | "md" | "lg";
  footer?: ReactNode;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    sheetRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      prev?.focus?.();
    };
  }, [open, onClose]);

  if (!mounted || typeof document === "undefined") return null;

  const maxW = size === "sm" ? "max-w-md" : size === "lg" ? "max-w-2xl" : "max-w-lg";

  return createPortal(
    <Presence show={open} variant="dialog">
      <div
        className="dk-overlay"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div
          ref={sheetRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={`dk-sheet w-full ${maxW} rounded-[28px] border border-[#E4E0D4] bg-[#FFFFFF] overflow-hidden flex flex-col max-h-[90dvh]`}
        >
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#E4E0D4]">
            <h2 className="text-base font-heading font-semibold text-black">{title}</h2>
            <button
              type="button"
              className="h-9 w-9 rounded-full bg-[#F3F8F7] hover:bg-[#ECE8DC] text-[#5C574C] hover:text-black flex items-center justify-center cursor-pointer"
              onClick={onClose}
              aria-label="Close"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="p-6 overflow-y-auto flex-1 min-w-0 text-sm text-black">{children}</div>
          {footer ? (
            <div className="px-6 py-4 border-t border-[#E4E0D4] bg-[#F3F8F7] flex items-center justify-end gap-2.5">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </Presence>,
    document.body
  );
}

export interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => setState({ ...opts, resolve }));
  }, []);

  const answer = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const confirmNode = (
    <Sheet
      open={!!state}
      onClose={() => answer(false)}
      title={state?.title ?? ""}
      size="sm"
      footer={
        <>
          <button
            type="button"
            className="ds-btn outline sm"
            onClick={() => answer(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className={state?.danger ? "ds-btn sm danger" : "ds-btn sm"}
            onClick={() => answer(true)}
          >
            {state?.confirmLabel ?? "Confirm"}
          </button>
        </>
      }
    >
      <p className="text-xs leading-relaxed text-slate-600">{state?.message}</p>
    </Sheet>
  );

  return { confirm, confirmNode };
}
