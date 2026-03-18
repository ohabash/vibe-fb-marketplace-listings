"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import type { Listing } from "@/types/listing";

interface Props {
  listing: Listing;
  onRescrapeComplete: (updated: Listing) => void;
  onDeleteComplete: (id: string) => void;
  /** "button" = standalone pill button, "row" = compact icon-only for table rows */
  variant?: "button" | "row";
}

export default function ActionMenu({ listing, onRescrapeComplete, onDeleteComplete, variant = "button" }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setConfirmDelete(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function handleRescrape() {
    setOpen(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/rescrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: listing.url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      if (data.listing) onRescrapeComplete(data.listing);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    setOpen(false);
    setConfirmDelete(false);
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/listings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: listing.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Delete failed");
      onDeleteComplete(listing.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setTimeout(() => setError(null), 4000);
    } finally {
      setLoading(false);
    }
  }

  const triggerClass =
    variant === "row"
      ? "p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-800 transition-colors"
      : "flex items-center gap-1.5 text-xs font-medium border border-slate-200 rounded-lg px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 transition-colors shadow-sm";

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={() => { setOpen((o) => !o); setConfirmDelete(false); }}
        disabled={loading}
        className={triggerClass}
        aria-haspopup="true"
        aria-expanded={open}
      >
        {loading ? (
          <RefreshCw size={13} className="animate-spin text-blue-500" />
        ) : variant === "row" ? (
          <span className="text-xs font-semibold leading-none">···</span>
        ) : (
          <>
            Actions
            <ChevronDown size={13} className={`transition-transform ${open ? "rotate-180" : ""}`} />
          </>
        )}
      </button>

      {error && (
        <div className="absolute right-0 top-full mt-1 z-50 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 whitespace-nowrap shadow">
          {error}
        </div>
      )}

      {open && !loading && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[170px] bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden">
          <button
            onClick={handleRescrape}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors text-left"
          >
            <RefreshCw size={13} className="text-slate-400 shrink-0" />
            Rescrape listing
          </button>

          <div className="border-t border-slate-100" />

          {confirmDelete ? (
            <div className="px-4 py-2.5">
              <p className="text-xs text-slate-500 mb-2">Delete listing?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg px-2 py-1.5 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-xs font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg px-2 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 transition-colors text-left"
            >
              <Trash2 size={13} className="shrink-0" />
              Delete listing
            </button>
          )}
        </div>
      )}
    </div>
  );
}
