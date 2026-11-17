"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { Icon } from "./Icon";

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

let toastsState: ToastItem[] = [];
const listeners: Set<ToastListener> = new Set();

function emit() {
  listeners.forEach((l) => l([...toastsState]));
}

type ToastOpts = { id?: string; duration?: number; icon?: unknown;[key: string]: unknown };

export const toast = Object.assign(
  (message: string, opts?: ToastOpts) =>
    toast.show(message, "info", opts?.duration ?? 3500, opts?.id),
  {
    show(message: string, type: ToastType = "info", duration = 3500, customId?: string) {
      if (!message) return "";
      const id = customId || Math.random().toString(36).substring(2, 9);
      toastsState = [{ id, type, message, duration }, ...toastsState.filter((t) => t.id !== id)].slice(0, 5);
      emit();
      if (duration > 0) {
        setTimeout(() => toast.dismiss(id), duration);
      }
      return id;
    },
    success(message: string, opts?: ToastOpts) {
      return this.show(String(message), "success", opts?.duration ?? 3500, opts?.id);
    },
    error(message: string, opts?: ToastOpts) {
      return this.show(String(message), "error", opts?.duration ?? 4000, opts?.id);
    },
    info(message: string, opts?: ToastOpts) {
      return this.show(String(message), "info", opts?.duration ?? 3500, opts?.id);
    },
    loading(message: string, opts?: ToastOpts) {
      return this.show(String(message), "info", opts?.duration ?? 10000, opts?.id);
    },
    warning(message: string, opts?: ToastOpts) {
      return this.show(String(message), "warning", opts?.duration ?? 3500, opts?.id);
    },
    dismiss(id?: string | number) {
      if (!id) {
        toastsState = [];
      } else {
        toastsState = toastsState.filter((t) => t.id !== String(id));
      }
      emit();
    },
    clear() {
      toastsState = [];
      emit();
    },
    custom(message: unknown) {
      return this.show(typeof message === "string" ? message : "Notification", "info");
    },
    async promise<T>(
      p: Promise<T>,
      msgs: { loading: string; success: string | ((v: T) => string); error: string | ((e: any) => string) }
    ) {
      const id = this.loading(msgs.loading);
      try {
        const res = await p;
        const okMsg = typeof msgs.success === "function" ? msgs.success(res) : msgs.success;
        this.success(okMsg, { id });
        return res;
      } catch (err) {
        const errMsg = typeof msgs.error === "function" ? msgs.error(err) : msgs.error;
        this.error(errMsg, { id });
        throw err;
      }
    },
  }
);

const Ctx = createContext({
  show: (msg: string, tone?: "ok" | "error" | "info") =>
    toast.show(msg, tone === "ok" ? "success" : tone === "error" ? "error" : "info"),
  success: (msg: string) => toast.success(msg),
  error: (msg: string) => toast.error(msg),
  info: (msg: string) => toast.info(msg),
  dismiss: (id?: string | number) => toast.dismiss(id),
});

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useToast() {
  return useContext(Ctx);
}

export function ToastContainer() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (newToasts: ToastItem[]) => setToasts(newToasts);
    listeners.add(handler);
    return () => {
      listeners.delete(handler);
    };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[99999] flex flex-col-reverse items-center gap-2 max-w-md w-full pointer-events-none px-4 select-none"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const isSuccess = t.type === "success";
        const isError = t.type === "error";
        const isWarning = t.type === "warning";

        return (
          <div
            key={t.id}
            onClick={() => toast.dismiss(t.id)}
            className={`pointer-events-auto flex items-center gap-3 py-2.5 px-4 rounded-full border cursor-pointer transition-all animate-in slide-in-from-bottom-4 fade-in duration-200 w-fit max-w-full shadow-none ${
                isSuccess
                  ? "bg-[var(--md-surface-high)] border-[var(--md-outline)] text-[var(--md-on-surface)]"
                  : isError
                    ? "bg-[#9E2A2B] border-[#9E2A2B] text-white"
                    : isWarning
                      ? "bg-[var(--md-surface-high)] border-[var(--md-outline)] text-[var(--md-on-surface)]"
                      : "bg-[var(--md-surface)] border-[var(--md-outline)] text-[var(--md-on-surface)]"
              }`}
          >
            <span className="shrink-0">
              <Icon
                name={isSuccess ? "done" : isError ? "alertCircle" : isWarning ? "alert" : "info"}
                size={16}
                className={
                  isSuccess
                    ? "text-emerald-600"
                    : isError
                      ? "text-white"
                      : isWarning
                        ? "text-amber-600"
                        : "text-[var(--md-primary)]"
                }
              />
            </span>
            <span className="text-xs font-medium tracking-tight">{t.message}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toast.dismiss(t.id);
              }}
              className="opacity-65 hover:opacity-100 ml-1"
              aria-label="Dismiss"
            >
              <Icon name="close" size={14} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
