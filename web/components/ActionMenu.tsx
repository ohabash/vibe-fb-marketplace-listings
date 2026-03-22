"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, RefreshCw, Trash2 } from "lucide-react";
import type { Listing } from "@/types/listing.types";
import FbReloginButton from "./FbReloginButton";

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

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

  function handleToggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownStyle({
        position: "fixed",
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    setOpen((o) => !o);
    setConfirmDelete(false);
  }

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
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      if (!msg.includes("SESSION_EXPIRED")) setTimeout(() => setError(null), 4000);
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
      ? "p-1.5 rounded-lg hover:bg-lift text-lo hover:text-hi transition-colors"
      : "flex items-center gap-1.5 text-xs font-medium border border-white/[0.06] rounded-lg px-3 py-2 bg-card hover:bg-lift text-md transition-colors shadow-sm";

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        ref={buttonRef}
        onClick={handleToggle}
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
        <div style={dropdownStyle} className="z-[9999] text-xs bg-red-950/50 border border-red-800/50 rounded-lg px-3 py-2 shadow min-w-[200px]">
          {error.includes("SESSION_EXPIRED") ? (
            <div className="flex flex-col gap-2">
              <span className="text-red-400 font-medium">Facebook session expired</span>
              <FbReloginButton />
            </div>
          ) : (
            <span className="text-red-400 whitespace-nowrap">{error}</span>
          )}
        </div>
      )}

      {open && !loading && (
        <div style={dropdownStyle} className="z-[9999] min-w-[170px] bg-card/80 backdrop-blur-xl rounded-xl border border-white/[0.06] shadow-[0_10px_30px_rgba(0,0,0,0.6)] overflow-hidden">
          {process.env.NODE_ENV === "development" && (
            <>
              <button
                onClick={handleRescrape}
                className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-md hover:bg-lift transition-colors text-left"
              >
                <RefreshCw size={13} className="text-lo shrink-0" />
                Rescrape listing
              </button>

              <div className="border-t border-white/[0.06]" />
            </>
          )}

          {confirmDelete ? (
            <div className="px-4 py-2.5">
              <p className="text-xs text-lo mb-2">Delete listing?</p>
              <div className="flex gap-2">
                <button
                  onClick={handleDelete}
                  className="flex-1 text-xs font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg px-2 py-1.5 transition-colors"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 text-xs font-medium bg-lift hover:bg-muted-bg text-md rounded-lg px-2 py-1.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-950/40 transition-colors text-left"
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
