"use client";

import { useEffect } from "react";

/**
 * Ported from X:\fest-ms\src\components\dashboard\ResponsiveTables.tsx
 * Copies column headings onto cells (`data-label`) so tables inside `.ds-main`
 * stack into clean Khaki/Porcelain cards on viewports under 700px.
 */
export function ResponsiveTables() {
  useEffect(() => {
    let frame = 0;

    const label = (table: HTMLTableElement) => {
      if (table.hasAttribute("data-no-rt")) return;
      const headRow = table.tHead?.rows[table.tHead.rows.length - 1];
      if (!headRow) return;
      const heads: string[] = [];
      Array.from(headRow.cells).forEach((th) => {
        const text = (th.textContent || "").replace(/\s+/g, " ").trim();
        for (let i = 0; i < Math.max(1, th.colSpan); i++) heads.push(text);
      });
      if (!heads.some(Boolean)) return;
      table.setAttribute("data-rt", "1");
      Array.from(table.tBodies).forEach((body) => {
        Array.from(body.rows).forEach((row) => {
          let col = 0;
          Array.from(row.cells).forEach((cell) => {
            const span = Math.max(1, cell.colSpan);
            if (span === 1 && !cell.hasAttribute("data-label") && heads[col]) {
              cell.setAttribute("data-label", heads[col]);
            }
            if (span > 1) cell.setAttribute("data-span", "all");
            col += span;
          });
        });
      });
    };

    const run = () => {
      frame = 0;
      document.querySelectorAll<HTMLTableElement>(".ds-main table").forEach(label);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(scheduleFrame);
    };
    const scheduleFrame = () => run();

    run();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return null;
}

