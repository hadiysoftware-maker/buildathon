"use client";

import { useEffect } from "react";
import { Icon } from "./Icon";
import { Presence } from "./Presence";
import { useToast } from "./Toast";

export function Notice({
  tone,
  children,
  inline,
}: {
  tone: "ok" | "error" | "warn";
  children: string | null | undefined;
  inline?: boolean;
}) {
  const toast = useToast();
  const asToast = tone === "ok" && !inline;

  useEffect(() => {
    if (asToast && children) toast.success(children);
  }, [asToast, children, toast]);

  if (asToast) return null;

  return (
    <Presence show={!!children} variant="collapse">
      <div className={`notice ${tone}`} role={tone === "error" ? "alert" : "status"}>
        <Icon name={tone === "ok" ? "done" : "alert"} size={18} />
        <span>{children}</span>
      </div>
    </Presence>
  );
}

