"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import useEmblaCarousel from "embla-carousel-react";
import {
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MapPin,
  User,
  Calendar,
  Tag,
  Package,
} from "lucide-react";
import { IoLocationSharp } from "react-icons/io5";
import type { Listing } from "@/types/listing.types";
import ActionMenu from "./ActionMenu";
import HeartButton from "./HeartButton";

const AMENITY_TOGGLES: { key: keyof Listing["inferred"]; label: string; emoji: string }[] = [
  { key: "parking",  label: "Parking",  emoji: "🚗" },
  { key: "pool",     label: "Pool",     emoji: "🏊" },
  { key: "gym",      label: "Gym",      emoji: "💪" },
  { key: "elevator", label: "Elevator", emoji: "🛗" },
  { key: "wifi",     label: "WiFi",     emoji: "📶" },
  { key: "terrace",  label: "Terrace",  emoji: "🌿" },
  { key: "jacuzzi",  label: "Jacuzzi",  emoji: "🛁" },
  { key: "security",     label: "Security", emoji: "🔒" },
  { key: "hasFurniture",            label: "Furnished",   emoji: "🛋️" },
  { key: "hasWasherDryer",          label: "W/D In-unit", emoji: "🧺" },
  { key: "hasWasherDryerInHookUps", label: "W/D Hookups",    emoji: "🔌" },
  { key: "requiresCosigner",        label: "Needs Cosigner", emoji: "📝" },
];

interface Props {
  listing: Listing;
  allListings: Listing[];
  onClose: () => void;
  onNotesChange: (id: string, notes: string) => void;
  onInferredChange: (id: string, inferred: Listing["inferred"]) => void;
  onRescrapeComplete: (updated: Listing) => void;
  onDeleteComplete: (id: string) => void;
  onHeartChange: (id: string, hearted: boolean) => void;
}

export default function ListingModal({
  listing,
  allListings,
  onClose,
  onNotesChange,
  onInferredChange,
  onRescrapeComplete,
  onDeleteComplete,
  onHeartChange,
}: Props) {
  const [current, setCurrent] = useState<Listing>(listing);
  const currentIndex = allListings.findIndex((l) => l.id === current.id);

  // Mobile carousel (Embla)
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: false });
  const [carouselIndex, setCarouselIndex] = useState(0);
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCarouselIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  const [notes, setNotes] = useState(current.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);
  const defaultInferred = {
    pet_friendly: "unknown" as const,
    has_view: 1 as const,
    neighborhood: 1 as const,
    pool: "unknown" as const,
    gym: "unknown" as const,
    parking: "unknown" as const,
    elevator: "unknown" as const,
    wifi: "unknown" as const,
    terrace: "unknown" as const,
    jacuzzi: "unknown" as const,
    security: "unknown" as const,
    hasFurniture: "unknown" as const,
    hasWasherDryer: "unknown" as const,
    hasWasherDryerInHookUps: "unknown" as const,
    requiresCosigner: "unknown" as const,
  };
  const [inferred, setInferred] = useState(current.inferred ?? defaultInferred);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keyboard nav
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") navigate(-1);
      if (e.key === "ArrowRight") navigate(1);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current, allListings]);

  function navigate(dir: 1 | -1) {
    const next = (currentIndex + dir + allListings.length) % allListings.length;
    const nextListing = allListings[next];
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    setCurrent(nextListing);
    setNotes(nextListing.notes ?? "");
    setInferred(nextListing.inferred ?? defaultInferred);
    setDescExpanded(false);
    setCarouselIndex(0);
    setTimeout(() => emblaApi?.scrollTo(0, true), 0);
  }

  async function saveNotes(value: string) {
    setSaving(true);
    setSaved(false);
    try {
      await fetch("/api/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, notes: value }),
      });
      onNotesChange(current.id, value);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleInferredChange(patch: Partial<typeof inferred>) {
    const updated = { ...inferred, ...patch };
    setInferred(updated);
    setCurrent((prev) => ({ ...prev, inferred: updated }));
    onInferredChange(current.id, updated);
    await fetch("/api/listings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: current.id, inferred: patch }),
    });
  }

  function handleNotesChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setNotes(value);
    if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
    notesTimerRef.current = setTimeout(() => saveNotes(value), 1000);
  }

  const formatPrice = (l: Listing) => {
    if (l.price.amount == null) return "—";
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: l.price.currency,
      maximumFractionDigits: 0,
    }).format(l.price.amount);
  };

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  };

  const shortDesc = current.description.length > 300
    ? current.description.slice(0, 300) + "…"
    : current.description;

  // Shared details content rendered in both layouts
  const detailsContent = (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 leading-snug">
            {current.title}
          </h2>
          <p className="text-2xl font-bold text-emerald-600 mt-1">
            {formatPrice(current)}
            <span className="text-sm font-normal text-slate-500 ml-1">/ mo</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <HeartButton listing={current} onChange={onHeartChange} size={18} />
          <ActionMenu
            listing={current}
            onRescrapeComplete={(updated) => { setCurrent(updated); onRescrapeComplete(updated); }}
            onDeleteComplete={(id) => { onDeleteComplete(id); onClose(); }}
            variant="button"
          />
          <a
            href={current.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-300 rounded-lg px-3 py-2 transition-colors"
          >
            <ExternalLink size={13} />
            Facebook
          </a>
        </div>
      </div>

      {/* Unit details badges */}
      {(current.unit_details?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-2">
          {(current.unit_details ?? []).map((d, i) => (
            <span key={i} className="text-xs font-medium bg-slate-100 text-slate-700 px-2.5 py-1 rounded-full">
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Info grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <InfoRow icon={<MapPin size={14} />} label="Location">
          {(() => {
            const { latitude, longitude } = current.location.coordinates;
            const label = [current.location.city, current.location.state, current.location.country]
              .filter(Boolean).join(", ") + (current.location.postal_code ? ` (${current.location.postal_code})` : "");
            const mapsUrl = latitude != null && longitude != null
              ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
            return mapsUrl ? (
              <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                <IoLocationSharp size={14} className="text-red-400 shrink-0" />
                {label}
              </a>
            ) : label;
          })()}
        </InfoRow>
        <InfoRow icon={<Calendar size={14} />} label="Posted">{formatDate(current.posted_at)}</InfoRow>
        <InfoRow icon={<Tag size={14} />} label="Category">{current.category || "—"}</InfoRow>
        <InfoRow icon={<Package size={14} />} label="Availability">{current.availability || "—"}</InfoRow>
        <InfoRow icon={<User size={14} />} label="Seller">
          <a href={current.seller.profile_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
            {current.seller.name || "—"}
          </a>
        </InfoRow>
      </div>

      {/* Inferred ratings */}
      <div className="border border-slate-100 rounded-xl p-4 bg-slate-50/60">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">Your Assessment</p>
        <div className="flex flex-wrap gap-5">
          <InferredToggle label="Pet Friendly" emoji="🐾"
            options={[["unknown", "?"], [true, "Yes"], [false, "No"]] as const}
            value={inferred.pet_friendly}
            activeClass={(v) => v === true ? "bg-emerald-500 text-white" : v === false ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700"}
            onChange={(v) => handleInferredChange({ pet_friendly: v })}
          />
          <InferredToggle label="Has View" emoji="🏙️"
            options={[[1, "1"], [2, "2"], [3, "3"]] as const}
            value={inferred.has_view}
            activeClass={(v) => v === 3 ? "bg-emerald-500 text-white" : v === 2 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-700"}
            onChange={(v) => handleInferredChange({ has_view: v })}
          />
          <InferredToggle label="Neighborhood" emoji="🏘️"
            options={[[1, "1"], [2, "2"], [3, "3"]] as const}
            value={inferred.neighborhood}
            activeClass={(v) => v === 3 ? "bg-emerald-500 text-white" : v === 2 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-700"}
            onChange={(v) => handleInferredChange({ neighborhood: v })}
          />
        </div>
        <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-slate-100">
          {AMENITY_TOGGLES.map(({ key, label, emoji }) => (
            <InferredToggle key={key} label={label} emoji={emoji}
              options={[["unknown", "?"], [true, "Yes"], [false, "No"]] as const}
              value={(inferred[key] ?? "unknown") as "unknown" | boolean}
              activeClass={(v) => v === true ? "bg-emerald-500 text-white" : v === false ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700"}
              onChange={(v) => handleInferredChange({ [key]: v })}
            />
          ))}
        </div>
      </div>

      {/* Description */}
      {current.description && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Description</p>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {descExpanded ? current.description : shortDesc}
          </p>
          {current.description.length > 300 && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-blue-600 hover:underline mt-1">
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Notes</p>
          {saving && <span className="text-xs text-slate-400 animate-pulse">Saving…</span>}
          {saved && <span className="text-xs text-emerald-500">Saved ✓</span>}
        </div>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          placeholder="Add your notes about this listing…"
          rows={3}
          className="w-full text-sm border border-slate-200 rounded-xl p-3 text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-200 focus:border-blue-400 resize-none transition-colors"
        />
      </div>
    </div>
  );

  // Shared sticky top bar
  const topBar = (
    <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-1">
        {allListings.length > 1 && (
          <>
            <button
              onClick={() => navigate(-1)}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Previous listing"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-slate-400 tabular-nums px-1">
              {currentIndex + 1} / {allListings.length}
            </span>
            <button
              onClick={() => navigate(1)}
              disabled={currentIndex === allListings.length - 1}
              className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next listing"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-slate-100 transition-colors"
        aria-label="Close"
      >
        <X size={18} className="text-slate-600" />
      </button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true">
      {/* Backdrop — desktop only */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm hidden md:block"
        onClick={onClose}
      />

      {/* ── MOBILE layout: full-screen, carousel on top, details scroll below ── */}
      <div className="md:hidden absolute inset-0 bg-white flex flex-col overflow-hidden">
        {topBar}

        {/* Mobile carousel */}
        {current.images.length > 0 && (
          <div className="relative bg-slate-100 h-64 shrink-0">
            <div className="overflow-hidden h-full" ref={emblaRef}>
              <div className="flex h-full">
                {current.images.map((src, i) => (
                  <div key={i} className="relative flex-none w-full h-full">
                    <Image
                      src={src}
                      alt={`${current.title} image ${i + 1}`}
                      fill
                      className="object-contain"
                      sizes="100vw"
                      priority={i === 0}
                    />
                  </div>
                ))}
              </div>
            </div>
            {current.images.length > 1 && (
              <>
                <button onClick={scrollPrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={scrollNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {current.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => emblaApi?.scrollTo(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${i === carouselIndex ? "bg-white" : "bg-white/40"}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Mobile details — scroll independently */}
        <div className="flex-1 overflow-y-auto">
          {detailsContent}
        </div>
      </div>

      {/* ── DESKTOP layout: centered modal, 2-column ── */}
      <div className="hidden md:flex absolute inset-0 items-center justify-center p-4">
        <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden">

          {/* Left column: stacked images, independent scroll */}
          <div className="w-[45%] shrink-0 bg-slate-100 overflow-y-auto">
            {current.images.length > 0 ? (
              <div className="flex flex-col gap-2 p-2">
                {current.images.map((src, i) => (
                  <Image
                    key={i}
                    src={src}
                    alt={`${current.title} image ${i + 1}`}
                    width={0}
                    height={0}
                    sizes="45vw"
                    className="w-full h-auto rounded-lg"
                    priority={i === 0}
                  />
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300 text-sm">
                No images
              </div>
            )}
          </div>

          {/* Right column: details, independent scroll */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0">
            {topBar}
            {detailsContent}
          </div>
        </div>
      </div>
    </div>
  );
}

function InferredToggle<T extends string | number | boolean>({
  label, emoji, options, value, activeClass, onChange,
}: {
  label: string;
  emoji: string;
  options: readonly (readonly [T, string])[];
  value: T;
  activeClass: (v: T) => string;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <span className="text-xs font-medium text-slate-400 block mb-1">{emoji} {label}</span>
      <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
        {options.map(([val, lbl]) => (
          <button
            key={String(val)}
            onClick={() => onChange(val)}
            className={`px-3 py-1.5 transition-colors ${
              value === val ? activeClass(val) : "bg-white text-slate-500 hover:bg-slate-50"
            }`}
          >
            {lbl}
          </button>
        ))}
      </div>
    </div>
  );
}

function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-slate-400 shrink-0">{icon}</span>
      <div>
        <span className="text-xs font-medium text-slate-400 block">{label}</span>
        <span className="text-sm text-slate-700">{children}</span>
      </div>
    </div>
  );
}
