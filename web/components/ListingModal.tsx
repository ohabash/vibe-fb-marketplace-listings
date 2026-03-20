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
  { key: "security", label: "Security", emoji: "🔒" },
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

  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [carouselIndex, setCarouselIndex] = useState(0);
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
  };
  const [inferred, setInferred] = useState(current.inferred ?? defaultInferred);
  const notesTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCarouselIndex(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => { emblaApi.off("select", onSelect); };
  }, [emblaApi]);

  // Keyboard: Escape = close, ArrowLeft/Right = navigate listings
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      // Don't hijack arrows when typing in textarea
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

  const navBtnClass =
    "hidden sm:flex items-center justify-center w-11 h-11 rounded-full bg-slate-900/75 hover:bg-slate-900 backdrop-blur-sm shadow-xl text-white transition-all shrink-0";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Left arrow */}
      <button
        onClick={() => navigate(-1)}
        className={`${navBtnClass} relative z-20 mr-3 ${currentIndex === 0 ? "invisible pointer-events-none" : ""}`}
        aria-label="Previous listing"
      >
        <ChevronLeft size={22} strokeWidth={2.5} />
      </button>

      {/* Panel */}
      <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto flex flex-col">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 p-1.5 rounded-full bg-white/80 hover:bg-slate-100 transition-colors shadow"
          aria-label="Close"
        >
          <X size={18} className="text-slate-600" />
        </button>

        {/* Listing counter */}
        {allListings.length > 1 && (
          <div className="absolute top-3 left-3 z-20 text-xs font-medium bg-black/40 text-white rounded-full px-2.5 py-1">
            {currentIndex + 1} / {allListings.length}
          </div>
        )}

        {/* Carousel */}
        {current.images.length > 0 && (
          <div className="relative bg-slate-100 rounded-t-2xl overflow-hidden h-60 sm:h-80 shrink-0">
            <div className="overflow-hidden h-full" ref={emblaRef}>
              <div className="flex h-full">
                {current.images.map((src, i) => (
                  <div key={i} className="relative flex-none w-full h-full">
                    <Image
                      src={src}
                      alt={`${current.title} image ${i + 1}`}
                      fill
                      className="object-cover"
                      sizes="(max-width: 672px) 100vw, 672px"
                      priority={i === 0}
                    />
                  </div>
                ))}
              </div>
            </div>

            {current.images.length > 1 && (
              <>
                <button
                  onClick={scrollPrev}
                  className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
                  aria-label="Previous image"
                >
                  <ChevronLeft size={18} />
                </button>
                <button
                  onClick={scrollNext}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 hover:bg-black/60 text-white transition-colors"
                  aria-label="Next image"
                >
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {current.images.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => emblaApi?.scrollTo(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === carouselIndex ? "bg-white" : "bg-white/40"
                      }`}
                      aria-label={`Go to image ${i + 1}`}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-5 sm:p-6 flex flex-col gap-5">
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
                onRescrapeComplete={(updated) => {
                  setCurrent(updated);
                  onRescrapeComplete(updated);
                }}
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
          {current.unit_details.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {current.unit_details.map((d, i) => (
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
                  .filter(Boolean)
                  .join(", ") + (current.location.postal_code ? ` (${current.location.postal_code})` : "");
                const mapsUrl = latitude != null && longitude != null
                  ? `https://www.google.com/maps?q=${latitude},${longitude}`
                  : null;
                return mapsUrl ? (
                  <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-600 hover:underline">
                    <IoLocationSharp size={14} className="text-red-400 shrink-0" />
                    {label}
                  </a>
                ) : label;
              })()}
            </InfoRow>
            <InfoRow icon={<Calendar size={14} />} label="Posted">
              {formatDate(current.posted_at)}
            </InfoRow>
            <InfoRow icon={<Tag size={14} />} label="Category">
              {current.category || "—"}
            </InfoRow>
            <InfoRow icon={<Package size={14} />} label="Availability">
              {current.availability || "—"}
            </InfoRow>
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
              <InferredToggle
                label="Pet Friendly"
                emoji="🐾"
                options={[["unknown", "?"], [true, "Yes"], [false, "No"]] as const}
                value={inferred.pet_friendly}
                activeClass={(v) => v === true ? "bg-emerald-500 text-white" : v === false ? "bg-red-500 text-white" : "bg-slate-200 text-slate-700"}
                onChange={(v) => handleInferredChange({ pet_friendly: v })}
              />
              <InferredToggle
                label="Has View"
                emoji="🏙️"
                options={[[1, "1"], [2, "2"], [3, "3"]] as const}
                value={inferred.has_view}
                activeClass={(v) => v === 3 ? "bg-emerald-500 text-white" : v === 2 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-700"}
                onChange={(v) => handleInferredChange({ has_view: v })}
              />
              <InferredToggle
                label="Neighborhood"
                emoji="🏘️"
                options={[[1, "1"], [2, "2"], [3, "3"]] as const}
                value={inferred.neighborhood}
                activeClass={(v) => v === 3 ? "bg-emerald-500 text-white" : v === 2 ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-700"}
                onChange={(v) => handleInferredChange({ neighborhood: v })}
              />
            </div>
            <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-slate-100">
              {AMENITY_TOGGLES.map(({ key, label, emoji }) => (
                <InferredToggle
                  key={key}
                  label={label}
                  emoji={emoji}
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
      </div>

      {/* Right arrow */}
      <button
        onClick={() => navigate(1)}
        className={`${navBtnClass} relative z-20 ml-3 ${currentIndex === allListings.length - 1 ? "invisible pointer-events-none" : ""}`}
        aria-label="Next listing"
      >
        <ChevronRight size={22} strokeWidth={2.5} />
      </button>
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
