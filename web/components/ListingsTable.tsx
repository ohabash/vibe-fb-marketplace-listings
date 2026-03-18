"use client";

import { useState, useMemo, useRef, useEffect } from "react";
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
import { ChevronUp, ChevronDown, ChevronsUpDown, Search, Plus, X, Loader2 } from "lucide-react";
import { IoLocationSharp } from "react-icons/io5";
import { TbBuildingCommunity } from "react-icons/tb";
import { MdOutlineLandscape } from "react-icons/md";
import type { Listing } from "@/types/listing";
import { ref, onValue } from "firebase/database";
import { db } from "@/lib/firebase";
import ListingModal from "./ListingModal";
import ActionMenu from "./ActionMenu";

const columnHelper = createColumnHelper<Listing>();

function formatPrice(listing: Listing) {
  if (listing.price.amount == null) return "—";
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: listing.price.currency,
    maximumFractionDigits: 0,
  }).format(listing.price.amount);
}

function formatDate(iso: string) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Extract numeric bed count from unit_details
function getBeds(unit_details: string[]): number | null {
  const d = unit_details.find((s) => /bed/i.test(s));
  if (!d) return null;
  const m = d.match(/(\d+)\s*bed/i);
  return m ? parseInt(m[1]) : null;
}

// Extract numeric bath count from unit_details
function getBaths(unit_details: string[]): number | null {
  const d = unit_details.find((s) => /bath/i.test(s));
  if (!d) return null;
  const m = d.match(/(\d+)\s*bath/i);
  return m ? parseInt(m[1]) : null;
}

// Color classes for 1-3 scale fields (has_view, neighborhood, etc.)
function scaleClass(v: number) {
  if (v === 3) return "bg-blue-50 text-blue-700 border-blue-200";
  if (v === 2) return "bg-green-100 text-green-800 border-green-300";
  return "bg-green-50 text-green-600 border-green-200";
}

// Amenity flags
function hasInUnitLaundry(unit_details: string[]) {
  return unit_details.some((d) => /in.unit laundry/i.test(d));
}
function hasBuildingLaundry(unit_details: string[]) {
  return unit_details.some((d) => /laundry in building/i.test(d));
}
function hasParking(unit_details: string[]) {
  return unit_details.some((d) => /parking/i.test(d));
}

function AmenityBadges({ unit_details }: { unit_details: string[] }) {
  const inUnit = hasInUnitLaundry(unit_details);
  const bldg = hasBuildingLaundry(unit_details);
  const parking = hasParking(unit_details);

  if (!inUnit && !bldg && !parking) return <span className="text-slate-300 text-xs">—</span>;

  return (
    <div className="flex gap-1 flex-wrap">
      {inUnit && (
        <span title="In-unit laundry" className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded px-1.5 py-0.5 whitespace-nowrap">
          🧺 In-unit
        </span>
      )}
      {bldg && (
        <span title="Laundry in building" className="text-xs bg-slate-50 text-slate-600 border border-slate-200 rounded px-1.5 py-0.5 whitespace-nowrap">
          🏢 Laundry
        </span>
      )}
      {parking && (
        <span title="Parking" className="text-xs bg-amber-50 text-amber-700 border border-amber-100 rounded px-1.5 py-0.5 whitespace-nowrap">
          🚗 Parking
        </span>
      )}
    </div>
  );
}

export default function ListingsTable() {
  const [listings, setListings] = useState<Listing[] | null>(null);

  useEffect(() => {
    const listingsRef = ref(db, "listings");
    const unsubscribe = onValue(listingsRef, (snapshot) => {
      const val = snapshot.val() as Record<string, Listing> | null;
      // Sort newest-first by default; listings without dateAdded fall to the bottom
      const rows = val ? Object.values(val) : [];
      rows.sort((a, b) => (b.dateAdded ?? 0) - (a.dateAdded ?? 0));
      setListings(rows);
    });
    return unsubscribe;
  }, []);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState("");
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null);

  // Add listing
  const [addUrl, setAddUrl] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [addState, setAddState] = useState<"idle" | "scraping" | "error">("idle");
  const [addError, setAddError] = useState("");
  const addInputRef = useRef<HTMLInputElement>(null);

  const columns = useMemo(
    () => [
      // Thumbnail
      columnHelper.accessor("images", {
        header: "",
        enableSorting: false,
        cell: (info) => {
          const imgs = info.getValue();
          return imgs[0] ? (
            <div className="relative w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-slate-100">
              <Image src={imgs[0]} alt="thumbnail" fill className="object-cover" sizes="56px" />
            </div>
          ) : (
            <div className="w-14 h-14 rounded-lg bg-slate-100 shrink-0" />
          );
        },
      }),

      // Title + notes preview
      columnHelper.accessor("title", {
        header: "Listing",
        cell: (info) => {
          const { notes, id } = info.row.original;
          return (
            <div className="max-w-[220px]">
              <span className="font-medium text-slate-900 line-clamp-2 block leading-snug">
                {info.getValue()}
              </span>
              {notes && (
                <span className="text-xs text-slate-400 line-clamp-1 mt-0.5 italic">
                  {notes}
                </span>
              )}
              <span className="text-[10px] text-slate-300 font-mono mt-0.5 block">{id}</span>
            </div>
          );
        },
      }),

      // Price
      columnHelper.accessor((row) => row.price.amount, {
        id: "price",
        header: "Price/mo",
        cell: (info) => (
          <span className="font-bold text-emerald-700 whitespace-nowrap text-sm">
            {formatPrice(info.row.original)}
          </span>
        ),
      }),

      // Location: city + postal code
      columnHelper.accessor(
        (row) => `${row.location.city} ${row.location.postal_code}`.trim(),
        {
          id: "location",
          header: "Location",
          cell: (info) => {
            const { city, state, postal_code, coordinates } = info.row.original.location;
            const { latitude, longitude } = coordinates;
            const mapsUrl = latitude != null && longitude != null
              ? `https://www.google.com/maps?q=${latitude},${longitude}`
              : null;
            const inner = (
              <div className="whitespace-nowrap">
                <span className={mapsUrl ? "text-blue-600" : "text-slate-700"}>
                  {[city, state].filter(Boolean).join(", ")}
                </span>
                {postal_code && (
                  <span className="block text-xs text-slate-400">{postal_code}</span>
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
                <IoLocationSharp size={14} className="text-red-400 group-hover:text-red-500 mt-0.5 shrink-0" />
                {inner}
              </a>
            ) : inner;
          },
        }
      ),

      // Beds (sortable number)
      columnHelper.accessor((row) => getBeds(row.unit_details) ?? -1, {
        id: "beds",
        header: "Beds",
        cell: (info) => {
          const v = getBeds(info.row.original.unit_details);
          return (
            <span className="text-slate-700 font-medium whitespace-nowrap">
              {v != null ? `${v} bd` : "—"}
            </span>
          );
        },
      }),

      // Baths (sortable number)
      columnHelper.accessor((row) => getBaths(row.unit_details) ?? -1, {
        id: "baths",
        header: "Baths",
        cell: (info) => {
          const v = getBaths(info.row.original.unit_details);
          return (
            <span className="text-slate-700 font-medium whitespace-nowrap">
              {v != null ? `${v} ba` : "—"}
            </span>
          );
        },
      }),

      // Amenities
      columnHelper.display({
        id: "amenities",
        header: "Amenities",
        enableSorting: false,
        cell: (info) => <AmenityBadges unit_details={info.row.original.unit_details} />,
      }),

      // Pet friendly (sortable: false=0, unknown=1, true=2)
      columnHelper.accessor((row) => {
        const v = row.inferred?.pet_friendly;
        return v === true ? 2 : v === false ? 0 : 1;
      }, {
        id: "pet_friendly",
        header: "Pets",
        cell: (info) => {
          const v = info.row.original.inferred?.pet_friendly;
          if (v === true) return <span className="text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-100 rounded px-1.5 py-0.5 whitespace-nowrap">🐾 Yes</span>;
          if (v === false) return <span className="text-xs font-medium bg-red-50 text-red-600 border border-red-100 rounded px-1.5 py-0.5 whitespace-nowrap">🚫 No</span>;
          return <span className="text-slate-300 text-xs whitespace-nowrap">?</span>;
        },
      }),

      // Has view (sortable 1-3)
      columnHelper.accessor((row) => row.inferred?.has_view ?? 1, {
        id: "has_view",
        header: "View",
        cell: (info) => {
          const v = info.row.original.inferred?.has_view ?? 1;
          return <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded px-1.5 py-0.5 whitespace-nowrap ${scaleClass(v)}`}><MdOutlineLandscape size={13} /> {v}</span>;
        },
      }),

      // Neighborhood (sortable 1-3)
      columnHelper.accessor((row) => row.inferred?.neighborhood ?? 1, {
        id: "neighborhood",
        header: "Area",
        cell: (info) => {
          const v = info.row.original.inferred?.neighborhood ?? 1;
          return <span className={`inline-flex items-center gap-1 text-xs font-medium border rounded px-1.5 py-0.5 whitespace-nowrap ${scaleClass(v)}`}><TbBuildingCommunity size={12} /> {v}</span>;
        },
      }),

      // Posted date
      columnHelper.accessor("posted_at", {
        header: "Posted",
        cell: (info) => (
          <span className="text-slate-500 whitespace-nowrap text-xs">{formatDate(info.getValue())}</span>
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
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const table = useReactTable({
    data: listings ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, columnId, filterValue) => {
      const search = String(filterValue).toLowerCase();
      // Always search the listing id regardless of visible columns
      if (row.original.id.includes(search)) return true;
      const cell = row.getValue<unknown>(columnId);
      return String(cell ?? "").toLowerCase().includes(search);
    },
  });

  async function handleAddListing() {
    const url = addUrl.trim();
    if (!url) return;
    // Block duplicates before opening a browser
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

  function handleNotesChange(id: string, notes: string) {
    setListings((prev) =>
      (prev ?? []).map((l) => (l.id === id ? { ...l, notes } : l))
    );
    if (selectedListing?.id === id) {
      setSelectedListing((prev) => (prev ? { ...prev, notes } : prev));
    }
  }

  function handleInferredChange(id: string, inferred: Listing["inferred"]) {
    setListings((prev) =>
      (prev ?? []).map((l) => (l.id === id ? { ...l, inferred } : l))
    );
    if (selectedListing?.id === id) {
      setSelectedListing((prev) => (prev ? { ...prev, inferred } : prev));
    }
  }

  function handleRescrapeComplete(updated: Listing) {
    setListings((prev) =>
      (prev ?? []).map((l) => (l.id === updated.id ? updated : l))
    );
    if (selectedListing?.id === updated.id) {
      setSelectedListing(updated);
    }
  }

  function handleDeleteComplete(id: string) {
    setListings((prev) => (prev ?? []).filter((l) => l.id !== id));
    if (selectedListing?.id === id) {
      setSelectedListing(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Toolbar: search + add */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="relative max-w-sm flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={globalFilter}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search listings…"
              className="w-full pl-9 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl shadow-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 transition-colors"
            />
          </div>
          <button
            onClick={() => {
              setAddOpen((o) => !o);
              setAddState("idle");
              setAddError("");
              setTimeout(() => addInputRef.current?.focus(), 50);
            }}
            className="flex items-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-4 py-2 transition-colors shadow-sm shrink-0"
          >
            {addOpen ? <X size={15} /> : <Plus size={15} />}
            {addOpen ? "Cancel" : "Add listing"}
          </button>
        </div>

        {/* Add listing form */}
        {addOpen && (
          <div className="flex items-start gap-2 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm">
            <div className="flex-1">
              <input
                ref={addInputRef}
                type="url"
                value={addUrl}
                onChange={(e) => { setAddUrl(e.target.value); setAddState("idle"); setAddError(""); }}
                onKeyDown={(e) => e.key === "Enter" && handleAddListing()}
                placeholder="Paste Facebook Marketplace URL…"
                className="w-full text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
                disabled={addState === "scraping"}
              />
              {addState === "error" && (
                <p className="text-xs text-red-500 mt-1">{addError}</p>
              )}
            </div>
            <button
              onClick={handleAddListing}
              disabled={addState === "scraping" || !addUrl.trim()}
              className="flex items-center gap-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg px-3 py-1.5 transition-colors shrink-0"
            >
              {addState === "scraping" ? (
                <><Loader2 size={13} className="animate-spin" /> Scraping…</>
              ) : "Scrape"}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
        <table className="w-full text-sm border-collapse">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 select-none whitespace-nowrap ${
                      header.column.getCanSort() ? "cursor-pointer hover:text-slate-800 transition-colors" : ""
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-slate-300">
                          {header.column.getIsSorted() === "asc" ? (
                            <ChevronUp size={13} className="text-blue-500" />
                          ) : header.column.getIsSorted() === "desc" ? (
                            <ChevronDown size={13} className="text-blue-500" />
                          ) : (
                            <ChevronsUpDown size={13} />
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
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 text-sm">
                  Loading…
                </td>
              </tr>
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-slate-400 text-sm">
                  No listings found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50 cursor-pointer transition-colors"
                  onClick={() => setSelectedListing(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 align-middle">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-slate-400">
        {table.getFilteredRowModel().rows.length} listing
        {table.getFilteredRowModel().rows.length !== 1 ? "s" : ""}
      </p>

      {/* Modal */}
      {selectedListing && (
        <ListingModal
          listing={selectedListing}
          allListings={listings ?? []}
          onClose={() => setSelectedListing(null)}
          onNotesChange={handleNotesChange}
          onInferredChange={handleInferredChange}
          onRescrapeComplete={handleRescrapeComplete}
          onDeleteComplete={handleDeleteComplete}
        />
      )}
    </div>
  );
}
