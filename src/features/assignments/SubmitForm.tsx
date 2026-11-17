"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/dashboard/Kit";
import { toast } from "@/components/ui/Toast";
import { uploadFile } from "@/lib/storage/upload-client";
import { submitAssignment } from "./actions";

export function SubmitForm({ assignmentId, storageReady, resubmit }: { assignmentId: string; storageReady: boolean; resubmit: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [pct, setPct] = useState<number | null>(null);

  const go = () =>
    start(async () => {
      try {
        const fileIds: string[] = [];
        for (const f of files) fileIds.push(await uploadFile("work", f, setPct));
        const r = await submitAssignment({ assignmentId, text, fileIds });
        if (!r.ok) return void toast.error(r.error);
        toast.success(r.data?.late ? "Submitted (marked late)" : "Submitted. Good work!");
        setText(""); setFiles([]); router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not submit.");
      } finally {
        setPct(null);
      }
    });

  return (
    <div className="sf-form">
      <Field label="Your answer"><textarea rows={6} value={text} maxLength={20000} onChange={(e) => setText(e.target.value)} placeholder="Type your answer here (optional if you attach a file)" /></Field>
      <Field label="Attach files (up to 5, 15 MB each)">
        <input type="file" multiple disabled={!storageReady} aria-label="Attach files" accept=".pdf,.docx,.pptx,.xlsx,.png,.jpg,.jpeg,.webp,.txt" onChange={(e) => setFiles([...(e.target.files ?? [])].slice(0, 5))} />
      </Field>
      {files.length > 0 && <ul className="sf-files" aria-label="Selected files">{files.map((f) => <li key={f.name + f.size}><span>{f.name}</span><small>{f.size > 1048576 ? `${(f.size / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(f.size / 1024))} KB`}</small></li>)}</ul>}
      <div className="sf-actions">
        <button type="button" className="ds-btn sm" disabled={busy || (!text.trim() && files.length === 0)} onClick={go}>
          {busy ? (pct !== null ? `Uploading ${pct}%…` : "Submitting…") : resubmit ? "Resubmit" : "Submit"}
        </button>
      </div>
    </div>
  );
}
