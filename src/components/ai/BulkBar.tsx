"use client";

import { Icon } from "@/components/ui/Icon";

/** Toolbar for choosing several chats and deleting them together. The parent owns the state and the confirm dialog. */
export function BulkBar({ total, selected, selecting, onToggleMode, onSelectAll, onDelete }: { total: number; selected: number; selecting: boolean; onToggleMode: () => void; onSelectAll: () => void; onDelete: () => void }) {
  if (total === 0) return null;
  return (
    <div className="cp-bulk" role="toolbar" aria-label="Chat selection">
      {selecting ? (
        <>
          <button type="button" className="ds-btn outline sm" onClick={onSelectAll}>{selected === total ? "Clear" : "Select all"}</button>
          <button type="button" className="ds-btn sm danger" disabled={selected === 0} onClick={onDelete}><Icon name="delete" size={15} /> Delete {selected || ""}</button>
          <button type="button" className="ds-btn tonal sm" onClick={onToggleMode}>Done</button>
        </>
      ) : (
        <button type="button" className="ds-btn outline sm" onClick={onToggleMode}><Icon name="checkSquare" size={15} /> Select</button>
      )}
    </div>
  );
}
