"use client";

import { useEffect, useRef, useState } from "react";
import { NotebookPen } from "lucide-react";
import type { Listing } from "@/types/listing.types";

interface Props {
  listing: Listing;
  onSave: (id: string, notes: string) => void;
  /** Which side the dropdown opens toward. Defaults to "right" (bottom-right of icon). */
  dropdownAlign?: "left" | "right";
}

export default function NotesPopover({ listing, onSave, dropdownAlign = "right" }: Props) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(listing.notes ?? "");
  const [saving, setSaving] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasNotes = !!value.trim();

  // Keep value in sync when listing.notes changes externally (e.g. from Firebase)
  useEffect(() => {
    // Only sync if the popover is closed to avoid clobbering in-progress edits
    if (!open) {
      setValue(listing.notes ?? "");
    }
  }, [listing.notes, open]);

  async function persist(notes: string) {
    setSaving(true);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: listing.id, notes }),
      });
      onSave(listing.id, notes);
    } finally {
      setSaving(false);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setValue(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => persist(v), 700);
  }

  function closeAndFlush() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
      // Flush immediately with current value
      persist(value);
    }
    setOpen(false);
  }

  // Flush + cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Fire-and-forget: component is unmounting, best effort
        fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: listing.id, notes: value }),
        }).then(() => onSave(listing.id, value)).catch(() => {});
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  // Close on outside click
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        closeAndFlush();
      }
    }
    if (open) document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, value]);

  return (
    <div ref={containerRef} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => (open ? closeAndFlush() : setOpen(true))}
        className={`p-1.5 rounded-lg hover:bg-white/[0.08] transition-colors ${
          hasNotes ? "text-amber-500" : "text-lo opacity-40 hover:opacity-100"
        }`}
        title={hasNotes ? "View/edit notes" : "Add notes"}
      >
        <NotebookPen size={15} />
      </button>

      {open && (
        <div className={`absolute top-full mt-1 z-50 bg-card/80 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.6)] p-3 min-w-[280px] ${dropdownAlign === "right" ? "left-0" : "right-0"}`}>
          <textarea
            autoFocus
            value={value}
            onChange={handleChange}
            rows={5}
            placeholder="Add notes…"
            className="w-full text-sm text-hi placeholder-md bg-card border border-white/[0.08] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/50 resize-none transition-colors"
          />
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[10px] text-lo">
              {saving ? "Saving…" : "Auto-saves after 700ms"}
            </span>
            <button
              onClick={closeAndFlush}
              className="text-xs font-medium text-lo hover:text-hi transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
