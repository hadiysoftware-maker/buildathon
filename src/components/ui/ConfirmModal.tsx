"use client";

import { useEffect, useState } from "react";
import { ModalPortal } from "@/components/ui/ModalPortal";
import { Presence } from "@/components/ui/Presence";
import { Trash2, AlertTriangle, AlertCircle, X } from "@/components/HugeIcon";

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => unknown | Promise<unknown>;
  title?: string;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "primary" | "theme";
  icon?: React.ReactNode;
  isLoading?: boolean;
}

/**
 * `fest-ms`-aligned confirmation dialog built atop `.dk-overlay` and `.dk-sheet`.
 */
export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  description = "This action cannot be undone. Are you sure you want to continue?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "danger",
  icon,
  isLoading = false,
}: ConfirmModalProps) {
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !submitting && !isLoading) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, submitting, isLoading]);

  const handleConfirm = async () => {
    try {
      setSubmitting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error("Confirm action error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  const isBusy = submitting || isLoading;
  const toneClass = variant === "danger" ? "is-danger" : variant === "warning" ? "is-warning" : "";
  const confirmCls = variant === "danger" ? "ds-btn danger sm" : "ds-btn sm";

  return (
    <ModalPortal>
      <Presence show={isOpen} variant="dialog">
        <div className="dk-overlay" onClick={() => !isBusy && onClose()}>
          <div
            className="dk-sheet sm"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cm-confirm-head">
              <span className={`cm-ico ${toneClass}`}>
                {icon ? (
                  icon
                ) : variant === "danger" ? (
                  <Trash2 size={18} />
                ) : variant === "warning" ? (
                  <AlertTriangle size={18} />
                ) : (
                  <AlertCircle size={18} />
                )}
              </span>
              <h2>{title}</h2>
              <button
                type="button"
                className="dk-x"
                onClick={onClose}
                disabled={isBusy}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
            <div className="dk-sheet-body">
              <p className="cm-confirm-text">{description}</p>
            </div>
            <div className="dk-sheet-foot">
              <button type="button" className="ds-btn outline sm" disabled={isBusy} onClick={onClose}>
                {cancelText}
              </button>
              <button type="button" className={confirmCls} disabled={isBusy} onClick={handleConfirm}>
                {isBusy ? "Processing…" : confirmText}
              </button>
            </div>
          </div>
        </div>
      </Presence>
    </ModalPortal>
  );
}

