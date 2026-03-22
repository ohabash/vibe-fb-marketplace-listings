"use client";

import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import Image from "next/image";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
} from "@tanstack/react-table";
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Plus, X, Loader2, Play } from "lucide-react";
import { IoLocationSharp } from "react-icons/io5";
import { TbBuildingCommunity } from "react-icons/tb";
import { MdOutlineLandscape } from "react-icons/md";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import type { Listing } from "@/types/listing.types";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import ListingModal from "./ListingModal";
import ActionMenu from "./ActionMenu";
import NotesPopover from "./NotesPopover";
import HeartButton from "./HeartButton";
import FbReloginButton from "./FbReloginButton";
import { Tip, TooltipProvider } from "./Tooltip";
import AmenityFilter from "./AmenityFilter";
import { getListingAmenities, ALL_FILTER_AMENITIES } from "@/hooks/useAmenities";
import { uploadMedia } from "@/lib/uploadMedia";
import { FaPaw } from "react-icons/fa";

const columnHelper = createColumnHelper<Listing>();

function formatPrice(listing: Listing) {
  if (!listing.price) return "—";
  if (listing.price.text) return listing.price.text;
  if (listing.price.amount == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: listing.price.currency,
    maximumFractionDigits: 0,
  }).format(listing.price.amount);
}

function getBeds(unit_details: string[] | undefined): number | null {
  const d = (unit_details ?? []).find((s) => /bed/i.test(s));
  if (!d) return null;
  const m = d.match(/(\d+)\s*bed/i);
  return m ? parseInt(m[1]) : null;
}

function getBaths(unit_details: string[] | undefined): number | null {
  const d = (unit_details ?? []).find((s) => /bath/i.test(s));
  if (!d) return null;
  const m = d.match(/(\d+)\s*bath/i);
  return m ? parseInt(m[1]) : null;
}

function scaleClass(v: number) {
  if (v === 3) return "bg-violet-500/15 text-violet-300 border-violet-500/30";
  if (v === 2) return "bg-amber-500/15 text-amber-300 border-amber-500/30";
  return "bg-white/[0.04] text-lo border-white/[0.07]";
}

function AmenityBadges({ listing }: { listing: Listing }) {
  const badges = getListingAmenities(listing);
  if (badges.length === 0) return <span className="text-lo text-xs">—</span>;
  return (
    <div className="flex gap-1 flex-wrap whitespace-nowrap">
      {badges.map(({ label, emoji }) => (
        <span
          key={label}
          className="inline-flex whitespace-nowrap items-center gap-1 bg-white/[0.07] text-hi/80 rounded-full px-2 py-0.5 text-[11px] font-medium whitespace-nowrap border border-white/[0.06]"
        >
          <span className="text-xs leading-none">{emoji}</span>
          {label}
        </span>
      ))}
    </div>
  );
}

export default function ListingsTable() {
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    const listingsRef = ref(db, "listings");
    const unsubscribe = onValue(listingsRef, (snapshot) => {
      const val = snapshot.val() as Record<string, Listing> | null;
      const rows = val ? Object.values(val) : [];
      rows.sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
      setListings(rows);
    });
    return unsubscribe;
  }, []);

  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [amenityFilters, setAmenityFilters] = useState<Set<string>>(new Set());
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const dragDepths = useRef<Record<string, number>>({});

  const isFiltered = globalFilter.length > 0 || amenityFilters.size > 0 || sorting.length > 0;

  function clearAll() {
    setGlobalFilter("");
    setAmenityFilters(new Set());
    setSorting([]);
  }

  const filteredListings = useMemo(() => {
    if (!amenityFilters.size) return listings ?? [];
    return (listings ?? []).filter((l) => {
      return [...amenityFilters].every((f) => {
        const def = ALL_FILTER_AMENITIES.find((a) => a.label === f);
        return def ? def.match(l) : false;
      });
    });
  }, [listings, amenityFilters]);

  const [addUrl, setAddUrl] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addState, setAddState] = useState<"idle" | "scraping" | "error">("idle");
  const [addError, setAddError] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const indexBufferRef = useRef<string>("");
  const indexTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = tableScrollRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let axis: "x" | "y" | null = null;

    function onTouchStart(e: TouchEvent) {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      axis = null;
      el!.style.overflowX = "";
      el!.style.overflowY = "";
    }

    function onTouchMove(e: TouchEvent) {
      if (axis) return;
      const dx = Math.abs(e.touches[0].clientX - startX);
      const dy = Math.abs(e.touches[0].clientY - startY);
      if (dx < 4 && dy < 4) return;
      axis = dx > dy ? "x" : "y";
      el!.style.overflowX = axis === "y" ? "hidden" : "";
      el!.style.overflowY = axis === "x" ? "hidden" : "";
    }

    function onTouchEnd() {
      el!.style.overflowX = "";
      el!.style.overflowY = "";
      axis = null;
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd);
    el.addEventListener("touchcancel", onTouchEnd);
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (document.activeElement as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (!/^\d$/.test(e.key)) return;
      indexBufferRef.current += e.key;
      if (indexTimerRef.current) clearTimeout(indexTimerRef.current);
      indexTimerRef.current = setTimeout(() => {
        const idx = parseInt(indexBufferRef.current, 10) - 1;
        indexBufferRef.current = "";
        setListings((prev) => {
          if (prev && idx >= 0 && idx < prev.length) {
            setSelectedListing(prev[idx]);
          }
          return prev;
        });
      }, 400);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleNotesChange = useCallback((id: string, notes: string) => {
    setListings((prev) => (prev ?? []).map((l) => (l.id === id ? { ...l, notes } : l)));
    setSelectedListing((prev) => (prev?.id === id ? { ...prev, notes } : prev));
  }, []);

  const handleHeartChange = useCallback((id: string, hearted: boolean) => {
    setListings((prev) => (prev ?? []).map((l) => (l.id === id ? { ...l, hearted } : l)));
    setSelectedListing((prev) => (prev?.id === id ? { ...prev, hearted } : prev));
  }, []);

  const handleHeart2Change = useCallback((id: string, hearted2: boolean) => {
    setListings((prev) => (prev ?? []).map((l) => (l.id === id ? { ...l, hearted2 } : l)));
    setSelectedListing((prev) => (prev?.id === id ? { ...prev, hearted2 } : prev));
  }, []);

  const handleInferredChange = useCallback((id: string, inferred: Listing["inferred"]) => {
    setListings((prev) => (prev ?? []).map((l) => (l.id === id ? { ...l, inferred } : l)));
    setSelectedListing((prev) => (prev?.id === id ? { ...prev, inferred } : prev));
  }, []);

  const handleRescrapeComplete = useCallback((updated: Listing) => {
    setListings((prev) => (prev ?? []).map((l) => (l.id === updated.id ? updated : l)));
    setSelectedListing((prev) => (prev?.id === updated.id ? updated : prev));
  }, []);

  const handleDeleteComplete = useCallback((id: string) => {
    setListings((prev) => (prev ?? []).filter((l) => l.id !== id));
    setSelectedListing((prev) => (prev?.id === id ? null : prev));
  }, []);

  const handleMediaChange = useCallback((id: string, images: string[], videos: string[]) => {
    setListings((prev) => (prev ?? []).map((l) => (l.id === id ? { ...l, images, videos } : l)));
    setSelectedListing((prev) => (prev?.id === id ? { ...prev, images, videos } : prev));
  }, []);

  const columns = useMemo(() => [
    // Row index
    columnHelper.display({
      id: "index",
      header: "#",
      enableSorting: false,
      cell: (info) => (
        <span className="text-[10px] text-lo/60 tabular-nums font-mono">{info.row.index + 1}</span>
      ),
    }),

    // Thumbnail
    columnHelper.accessor("images", {
      header: "",
      enableSorting: false,
      cell: (info) => {
        const imgs = info.getValue() ?? [];
        const hasVideo = (info.row.original.videos?.length ?? 0) > 0;
        if (!imgs[0]) return <div className="w-14 h-14 rounded-xl bg-panel shrink-0 ring-1 ring-white/[0.06]" />;
        return (
          <HoverCardPrimitive.Root openDelay={150} closeDelay={100}>
            <HoverCardPrimitive.Trigger asChild>
              <div className="relative w-14 h-14 rounded-xl overflow-hidden shrink-0 bg-panel ring-1 ring-white/[0.06] cursor-zoom-in">
                <Image src={imgs[0]} alt="thumbnail" fill className="object-cover" sizes="56px" />
                {hasVideo && (
                  <div className="absolute bottom-1 right-1 bg-black/60 rounded-full p-0.5">
                    <Play size={9} className="text-white fill-white" />
                  </div>
                )}
              </div>
            </HoverCardPrimitive.Trigger>
            <HoverCardPrimitive.Portal>
              <HoverCardPrimitive.Content
                side="right"
                sideOffset={10}
                align="center"
                className="z-50 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95"
              >
                <div className="relative w-64 h-64">
                  <Image src={imgs[0]} alt="preview" fill className="object-cover" sizes="256px" />
                </div>
              </HoverCardPrimitive.Content>
            </HoverCardPrimitive.Portal>
          </HoverCardPrimitive.Root>
        );
      },
    }),

    // Title
    columnHelper.accessor("title", {
      header: "Listing",
      cell: (info) => {
        const { id, status } = info.row.original;
        return (
          <div className="min-w-[140px] max-w-[200px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-[13px] text-white/90 line-clamp-1 leading-tight">
                {info.getValue()}
              </span>
              {status === "sold" && (
                <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase bg-white/[0.06] text-md rounded-full px-1.5 py-0.5">Sold</span>
              )}
              {status === "pending" && (
                <span className="shrink-0 text-[9px] font-bold tracking-wide uppercase bg-amber-50 text-amber-500 border border-amber-200 rounded-full px-1.5 py-0.5">Pending</span>
              )}
            </div>
            <span className="text-[9px] text-lo/60 font-mono mt-0.5 block">{id}</span>
          </div>
        );
      },
    }),

    // Notes popover
    columnHelper.display({
      id: "notes_popover",
      header: "",
      enableSorting: false,
      cell: (info) => (
        <NotesPopover listing={info.row.original} onSave={handleNotesChange} />
      ),
    }),

    // Price
    columnHelper.accessor((row) => row.price?.amount ?? null, {
      id: "price",
      header: "Price",
      cell: (info) => (
        <span className="font-bold text-emerald-300 whitespace-nowrap text-[13px] tabular-nums">
          {formatPrice(info.row.original)}
        </span>
      ),
    }),

    // Location
    columnHelper.accessor(
      (row) => `${row.location?.city ?? ""} ${row.location?.postal_code ?? ""}`.trim(),
      {
        id: "location",
        header: "Location",
        cell: (info) => {
          const { city, state, postal_code, coordinates } = info.row.original.location ?? {};
          const { latitude, longitude } = coordinates ?? {};
          const mapsUrl = latitude != null && longitude != null
            ? `https://www.google.com/maps?q=${latitude},${longitude}`
            : null;
          const label = [city, state].filter(Boolean).join(", ");
          const inner = (
            <div className="whitespace-nowrap">
              <span className={`text-[12px] font-medium ${mapsUrl ? "text-sky-300" : "text-md"}`}>
                {label || "—"}
              </span>
              {postal_code && (
                <span className="block text-[10px] text-lo leading-tight">{postal_code}</span>
              )}
            </div>
          );
          return mapsUrl ? (
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-1 hover:underline group"
              onClick={(e) => e.stopPropagation()}
            >
              <IoLocationSharp size={12} className="text-red-400 group-hover:text-red-500 mt-0.5 shrink-0" />
              {inner}
            </a>
          ) : inner;
        },
      }
    ),

    // Size (beds + baths merged)
    columnHelper.accessor((row) => {
      const beds = getBeds(row.unit_details) ?? -1;
      const baths = getBaths(row.unit_details) ?? -1;
      return beds * 100 + baths;
    }, {
      id: "size",
      header: "Size",
      cell: (info) => {
        const beds = getBeds(info.row.original.unit_details);
        const baths = getBaths(info.row.original.unit_details);
        if (beds == null && baths == null) return <span className="text-lo text-xs">—</span>;
        return (
          <span className="text-[12px] text-md font-medium whitespace-nowrap tabular-nums">
            {beds != null ? `${beds}bd` : ""}
            {beds != null && baths != null ? <span className="text-lo mx-0.5">·</span> : null}
            {baths != null ? `${baths}ba` : ""}
          </span>
        );
      },
    }),

    // Amenities (emoji-only)
    columnHelper.display({
      id: "amenities",
      header: "Amenities",
      enableSorting: false,
      cell: (info) => <AmenityBadges listing={info.row.original} />,
    }),

    // Pets
    columnHelper.accessor((row) => {
      const v = row.inferred?.pet_friendly;
      return v === true ? 2 : v === false ? 0 : 1;
    }, {
      id: "pet_friendly",
      header: "Pets",
      cell: (info) => {
        const v = info.row.original.inferred?.pet_friendly;
        if (v === true) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 rounded-full px-1.5 py-0.5 whitespace-nowrap"><FaPaw size={11} /> Yes</span>;
        if (v === false) return <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-red-500/15 text-red-300 border border-red-500/25 rounded-full px-1.5 py-0.5 whitespace-nowrap">❌ No</span>;
        return <span className="text-lo/70 text-xs">?</span>;
      },
    }),

    // View (1-3)
    columnHelper.accessor((row) => row.inferred?.has_view ?? 1, {
      id: "has_view",
      header: "View",
      cell: (info) => {
        const v = info.row.original.inferred?.has_view ?? 1;
        const label = v === 3 ? "Great view" : v === 2 ? "Decent view" : "No notable view";
        return (
          <Tip content={label} side="top">
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold border rounded-full px-1.5 py-0.5 whitespace-nowrap cursor-default ${scaleClass(v)}`}>
              <MdOutlineLandscape size={11} /> {v}
            </span>
          </Tip>
        );
      },
    }),

    // Neighborhood (1-3)
    columnHelper.accessor((row) => row.inferred?.neighborhood ?? 1, {
      id: "neighborhood",
      header: "Area",
      cell: (info) => {
        const v = info.row.original.inferred?.neighborhood ?? 1;
        const label = v === 3 ? "Great neighborhood" : v === 2 ? "Decent neighborhood" : "Basic neighborhood";
        return (
          <Tip content={label} side="top">
            <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold border rounded-full px-1.5 py-0.5 whitespace-nowrap cursor-default ${scaleClass(v)}`}>
              <TbBuildingCommunity size={11} /> {v}
            </span>
          </Tip>
        );
      },
    }),

    // Hearts
    columnHelper.display({
      id: "heart",
      header: "",
      enableSorting: false,
      cell: (info) => (
        <div className="flex items-center gap-0.5">
          <HeartButton listing={info.row.original} onChange={handleHeartChange} />
          <HeartButton listing={info.row.original} onChange={handleHeart2Change} field="hearted2" />
        </div>
      ),
    }),

    // Actions
    columnHelper.display({
      id: "actions",
      header: "",
      enableSorting: false,
      cell: (info) => (
        <ActionMenu
          listing={info.row.original}
          onRescrapeComplete={handleRescrapeComplete}
          onDeleteComplete={handleDeleteComplete}
          variant="row"
        />
      ),
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [handleNotesChange, handleHeartChange, handleHeart2Change, handleRescrapeComplete, handleDeleteComplete]);

  const table = useReactTable({
    data: filteredListings,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      if (row.original.id.includes(search)) return true;
      const cell = row.getValue<unknown>(columnId);
      return String(cell ?? "").toLowerCase().includes(search);
    },
  });

  async function handleAddListing() {
    const url = addUrl.trim();
    if (!url) return;
    const idMatch = url.match(/\/item\/(\d+)/);
    if (idMatch && (listings ?? []).some((l) => l.id === idMatch[1])) {
      setAddState("error");
      setAddError("This listing is already in your list.");
      return;
    }
    setAddState("scraping");
    setAddError("");
    try {
      const res = await fetch("/api/rescrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Scrape failed");
      if (data.listing) {
        setListings((prev) =>
          prev === null ? [data.listing] :
          prev.some((l) => l.id === data.listing.id)
            ? prev.map((l) => (l.id === data.listing.id ? data.listing : l))
            : [...prev, data.listing]
        );
        setAddUrl("");
        setAddOpen(false);
        setAddState("idle");
      }
    } catch (err) {
      setAddState("error");
      setAddError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <TooltipProvider>
    <div className="flex flex-col gap-2 sm:gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-1">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold text-hi tracking-tight">Marketplace Listings</h1>
          <p className="text-[11px] text-lo mt-0.5 hidden sm:block">Facebook Marketplace · live data</p>
        </div>
        <div className="flex items-center gap-2">
          {process.env.NODE_ENV === "development" && (
            <button
              onClick={() => {
                setAddOpen((o) => !o);
                setAddState("idle");
                setAddError("");
                setTimeout(() => addInputRef.current?.focus(), 50);
              }}
              className="flex items-center gap-1.5 text-sm font-medium bg-accent hover:bg-accent/80 text-white rounded-xl px-3.5 py-1.5 transition-colors shadow-sm shrink-0"
            >
              {addOpen ? <X size={14} /> : <Plus size={14} />}
              {addOpen ? "Cancel" : "Add"}
            </button>
          )}
        </div>
      </div>

      {process.env.NODE_ENV === "development" && addOpen && (
        <div className="flex items-start gap-2 bg-card border border-white/[0.08] rounded-xl px-3.5 py-2.5 shadow-sm">
          <div className="flex-1">
            <input
              ref={addInputRef}
              type="url"
              value={addUrl}
              onChange={(e) => { setAddUrl(e.target.value); setAddState("idle"); setAddError(""); }}
              onKeyDown={(e) => e.key === "Enter" && handleAddListing()}
              placeholder="Paste Facebook Marketplace URL…"
              className="w-full text-sm text-hi placeholder-lo bg-transparent focus:outline-none"
              disabled={addState === "scraping"}
            />
            {addState === "error" && (
              addError.includes("SESSION_EXPIRED") ? (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-red-500">Facebook session expired</span>
                  <FbReloginButton />
                </div>
              ) : (
                <p className="text-xs text-red-500 mt-1">{addError}</p>
              )
            )}
          </div>
          <button
            onClick={handleAddListing}
            disabled={addState === "scraping" || !addUrl.trim()}
            className="flex items-center gap-1.5 text-xs font-medium bg-accent hover:bg-accent/80 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0"
          >
            {addState === "scraping" ? (
              <><Loader2 size={12} className="animate-spin" /> Scraping…</>
            ) : "Scrape"}
          </button>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {/* Search — left */}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-lo pointer-events-none" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search listings…"
              className="w-full pl-8 pr-4 py-1.5 text-sm bg-card border border-white/[0.08] rounded-xl shadow-sm placeholder-md text-hi focus:outline-none focus:ring-2 focus:ring-accent/25 focus:border-accent/50 transition-all"
            />
          </div>

          {/* Right side actions */}
          <div className="flex items-center gap-2 ml-auto">
            {isFiltered && (
              <button
                type="button"
                onClick={clearAll}
                className="flex items-center gap-1.5 text-sm font-medium text-md hover:text-hi bg-card border border-white/[0.08] rounded-xl px-3 py-1.5 transition-colors shadow-sm shrink-0"
              >
                <X size={14} />
                <span className="hidden sm:inline">Clear</span>
              </button>
            )}

            <AmenityFilter value={amenityFilters} onChange={setAmenityFilters} />
          </div>
        </div>

      </div>

      {/* Table */}
      <div ref={tableScrollRef} className="flex-1 min-h-0 overflow-auto rounded-2xl border border-white/[0.07] shadow-[0_0_0_1px_rgba(255,255,255,0.03),0_8px_24px_rgba(0,0,0,0.4)] bg-card">
        <table className="w-full text-sm border-collapse">
          <thead className="sticky top-0 z-10">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-white/[0.06] bg-card/95 backdrop-blur-md">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-lo select-none whitespace-nowrap ${
                      header.column.getCanSort() ? "cursor-pointer hover:text-md transition-colors" : ""
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-0.5">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span>
                          {header.column.getIsSorted() === "asc" ? (
                            <ChevronUp size={11} className="text-accent" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ChevronDown size={11} className="text-accent" />
                          ) : (
                            <ChevronsUpDown size={11} className="text-lo/50" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {listings === null ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-lo text-sm">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-3 py-12 text-center text-lo text-sm">
                  No listings found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => {
                const id = row.original.id;
                const isOver = dragOverId === id;
                const isUploading = uploadingId === id;
                return (
                <tr
                  key={row.id}
                  className={`border-b border-white/[0.05] last:border-0 cursor-pointer transition-all duration-150 ${
                    isOver ? "bg-accent/10 ring-2 ring-inset ring-accent" :
                    isUploading ? "bg-accent/5" :
                    "hover:bg-lift/80 hover:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.04)]"
                  }`}
                  onClick={() => setSelectedListing(row.original)}
                  onDragEnter={(e) => {
                    e.preventDefault();
                    dragDepths.current[id] = (dragDepths.current[id] ?? 0) + 1;
                    if (dragDepths.current[id] === 1) setDragOverId(id);
                  }}
                  onDragLeave={() => {
                    dragDepths.current[id] = (dragDepths.current[id] ?? 1) - 1;
                    if (dragDepths.current[id] === 0) setDragOverId(null);
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={async (e) => {
                    e.preventDefault();
                    dragDepths.current[id] = 0;
                    setDragOverId(null);
                    const files = Array.from(e.dataTransfer.files).filter(
                      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
                    );
                    if (!files.length) return;
                    setUploadingId(id);
                    try {
                      const { images, videos } = await uploadMedia(id, files);
                      handleMediaChange(id, images, videos);
                    } finally {
                      setUploadingId(null);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-1 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <p className="text-[11px] text-lo/70 font-medium tabular-nums">
        {table.getFilteredRowModel().rows.length} listing{table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
      </p>

      {selectedListing && (
        <ListingModal
          listing={selectedListing}
          allListings={listings ?? []}
          onClose={() => setSelectedListing(null)}
          onNotesChange={handleNotesChange}
          onInferredChange={handleInferredChange}
          onRescrapeComplete={handleRescrapeComplete}
          onDeleteComplete={handleDeleteComplete}
          onHeartChange={handleHeartChange}
          onHeart2Change={handleHeart2Change}
          onMediaChange={handleMediaChange}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
