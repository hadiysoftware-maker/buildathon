"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Sheet, Segmented, Field } from "@/components/dashboard/Kit";
import { toast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/storage/upload-client";
import { applyTextSize, getStoredFontSize, type FontSize } from "@/lib/theme";
import type { ShellUser } from "@/providers/permissions-provider";

export function AccountDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user: ShellUser;
}) {
  const [font, setFont] = useState<FontSize>("medium");
  const [uploading, setUploading] = useState(false);
  const router = useRouter();

  const onPhoto = async (f: File | undefined) => {
    if (!f) return;
    setUploading(true);
    try {
      await uploadFile("avatar", f);
      toast.success("Profile photo updated");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setFont(getStoredFontSize());
  }, [open]);

  return (
    <Sheet open={open} onClose={onClose} title="Account & preferences" subtitle={user.fullName} size="sm">
      <div className="cd-grid">
        <Field label="Role">
          <span className="cd-muted">{user.role.replace(/_/g, " ").toLowerCase()}</span>
        </Field>
        <Field label="Profile photo" hint="JPG, PNG or WebP, up to 2 MB.">
          <input type="file" aria-label="Choose a profile photo" accept="image/jpeg,image/png,image/webp" disabled={uploading} onChange={(e) => onPhoto(e.target.files?.[0])} />
        </Field>
        <Field label="Text size">
          <Segmented
            value={font}
            onChange={(v) => {
              setFont(v);
              applyTextSize(v);
            }}
            options={[
              { value: "small", label: "Small" },
              { value: "medium", label: "Medium" },
              { value: "large", label: "Large" },
            ]}
          />
        </Field>
      </div>
    </Sheet>
  );
}
