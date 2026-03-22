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
  Loader2,
  ImagePlus,
} from "lucide-react";
import { IoLocationSharp } from "react-icons/io5";
import { Play } from "lucide-react";
import type { Listing } from "@/types/listing.types";
import ActionMenu from "./ActionMenu";
import HeartButton from "./HeartButton";
import MediaUploader from "./MediaUploader";
import { uploadMedia } from "@/lib/uploadMedia";

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
  onHeart2Change: (id: string, hearted2: boolean) => void;
  onMediaChange: (id: string, images: string[], videos: string[]) => void;
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
  onHeart2Change,
  onMediaChange,
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

  // Sync modal state when the parent selects a different listing externally
  // (e.g. via the keyboard index shortcut while the modal is already open)
  useEffect(() => {
    setCurrent(listing);
    setNotes(listing.notes ?? "");
    setInferred(listing.inferred ?? defaultInferred);
    setDescExpanded(false);
    setCarouselIndex(0);
    setTimeout(() => emblaApi?.scrollTo(0, true), 0);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listing.id]);

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
    if (!l.price) return "—";
    if (l.price.text) return l.price.text;
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

  // Drag-and-drop upload
  const dragDepth = useRef(0);
  const [dropActive, setDropActive] = useState(false);
  const [dropUploading, setDropUploading] = useState(false);

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current++;
    if (dragDepth.current === 1) setDropActive(true);
  }
  function onDragLeave() {
    dragDepth.current--;
    if (dragDepth.current === 0) setDropActive(false);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }
  async function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragDepth.current = 0;
    setDropActive(false);
    const files = Array.from(e.dataTransfer.files).filter(
      (f) => f.type.startsWith("image/") || f.type.startsWith("video/")
    );
    if (!files.length) return;
    setDropUploading(true);
    try {
      const { images, videos } = await uploadMedia(current.id, files);
      handleUploadComplete(images, videos);
    } finally {
      setDropUploading(false);
    }
  }

  // Ordered media: first image, then all videos, then remaining images
  const orderedMedia: { type: "image" | "video"; src: string }[] = [
    ...(current.images[0] ? [{ type: "image" as const, src: current.images[0] }] : []),
    ...(current.videos ?? []).map((src) => ({ type: "video" as const, src })),
    ...current.images.slice(1).map((src) => ({ type: "image" as const, src })),
  ];

  function handleUploadComplete(images: string[], videos: string[]) {
    setCurrent((prev) => ({ ...prev, images, videos }));
    onMediaChange(current.id, images, videos);
  }

  // Shared details content rendered in both layouts
  const detailsContent = (
    <div className="flex flex-col gap-5 p-5 sm:p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white/95 leading-snug">
            {current.title}
          </h2>
          <p className="text-2xl font-bold text-emerald-300 mt-1">
            {formatPrice(current)}
            <span className="text-sm font-normal text-md ml-1">/ mo</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <HeartButton listing={current} onChange={onHeartChange} size={18} />
          <HeartButton listing={current} onChange={onHeart2Change} field="hearted2" size={18} />
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
            className="flex items-center gap-1.5 text-xs font-medium text-accent hover:text-accent/80 border border-accent/30 hover:border-accent/50 rounded-lg px-3 py-2 transition-colors"
          >
            <ExternalLink size={13} />
            Facebook
          </a>
        </div>
      </div>

      {/* Unit details badges */}
      {(current.unit_details?.length ?? 0) > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {(current.unit_details ?? []).map((d, i) => (
            <span key={i} className="text-xs font-medium bg-white/[0.08] text-hi/80 border border-white/[0.1] px-2.5 py-1 rounded-full">
              {d}
            </span>
          ))}
        </div>
      )}

      {/* Info rows — Railway style */}
      <div className="rounded-xl border border-white/[0.1] overflow-hidden divide-y divide-white/[0.07]">
        {(() => {
          const { latitude, longitude } = current.location?.coordinates ?? {};
          const locLabel = [current.location?.city, current.location?.state, current.location?.country]
            .filter(Boolean).join(", ") + (current.location?.postal_code ? ` (${current.location.postal_code})` : "");
          const mapsUrl = latitude != null && longitude != null
            ? `https://www.google.com/maps?q=${latitude},${longitude}` : null;
          return (
            <InfoRow icon={<MapPin size={13} />} label="Location">
              {mapsUrl ? (
                <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sky-300 hover:text-sky-200 transition-colors">
                  <IoLocationSharp size={13} className="text-red-400 shrink-0" />
                  {locLabel}
                </a>
              ) : locLabel}
            </InfoRow>
          );
        })()}
        <InfoRow icon={<Calendar size={13} />} label="Posted">{formatDate(current.posted_at)}</InfoRow>
        <InfoRow icon={<Tag size={13} />} label="Category">{current.category || "—"}</InfoRow>
        <InfoRow icon={<Package size={13} />} label="Availability">{current.availability || "—"}</InfoRow>
        <InfoRow icon={<User size={13} />} label="Seller">
          <a href={current.seller.profile_url} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-200 transition-colors">
            {current.seller.name || "—"}
          </a>
        </InfoRow>
      </div>

      {/* Inferred ratings */}
      <div className="border border-white/[0.1] rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-white/[0.08] bg-white/[0.03]">
          <p className="text-xs font-semibold uppercase tracking-wider text-lo">Your Assessment</p>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-5">
            <InferredToggle label="Pet Friendly" emoji="🐾"
              options={[["unknown", "?"], [true, "Yes"], [false, "No"]] as const}
              value={inferred.pet_friendly}
              activeClass={(v) => v === true ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/30" : v === false ? "bg-red-500/25 text-red-300 border-red-500/30" : "bg-white/[0.06] text-md"}
              onChange={(v) => handleInferredChange({ pet_friendly: v })}
            />
            <InferredToggle label="Has View" emoji="🏙️"
              options={[[1, "1"], [2, "2"], [3, "3"]] as const}
              value={inferred.has_view}
              activeClass={(v) => v === 3 ? "bg-violet-500/25 text-violet-300 border-violet-500/30" : v === 2 ? "bg-amber-500/25 text-amber-300 border-amber-500/30" : "bg-white/[0.06] text-md"}
              onChange={(v) => handleInferredChange({ has_view: v })}
            />
            <InferredToggle label="Neighborhood" emoji="🏘️"
              options={[[1, "1"], [2, "2"], [3, "3"]] as const}
              value={inferred.neighborhood}
              activeClass={(v) => v === 3 ? "bg-violet-500/25 text-violet-300 border-violet-500/30" : v === 2 ? "bg-amber-500/25 text-amber-300 border-amber-500/30" : "bg-white/[0.06] text-md"}
              onChange={(v) => handleInferredChange({ neighborhood: v })}
            />
          </div>
          <div className="flex flex-wrap gap-5 mt-4 pt-4 border-t border-white/[0.08]">
            {AMENITY_TOGGLES.map(({ key, label, emoji }) => (
              <InferredToggle key={key} label={label} emoji={emoji}
                options={[["unknown", "?"], [true, "Yes"], [false, "No"]] as const}
                value={(inferred[key] ?? "unknown") as "unknown" | boolean}
                activeClass={(v) => v === true ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/30" : v === false ? "bg-red-500/25 text-red-300 border-red-500/30" : "bg-white/[0.06] text-md"}
                onChange={(v) => handleInferredChange({ [key]: v })}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Description */}
      {current.description && (
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-md mb-1.5">Description</p>
          <p className="text-sm text-hi/85 whitespace-pre-wrap leading-relaxed">
            {descExpanded ? current.description : shortDesc}
          </p>
          {current.description.length > 300 && (
            <button onClick={() => setDescExpanded(!descExpanded)} className="text-xs text-accent hover:underline mt-1">
              {descExpanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {/* Notes */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-md">Notes</p>
          {saving && <span className="text-xs text-lo animate-pulse">Saving…</span>}
          {saved && <span className="text-xs text-emerald-400 font-medium">Saved ✓</span>}
        </div>
        <textarea
          value={notes}
          onChange={handleNotesChange}
          placeholder="Add your notes about this listing…"
          rows={3}
          className="w-full text-sm border border-white/[0.1] rounded-xl p-3 bg-white/[0.04] text-hi placeholder-lo focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent/40 resize-none transition-colors"
        />
      </div>
    </div>
  );

  // Shared sticky top bar
  const topBar = (
    <div className="sticky top-0 z-10 bg-[#1C1E27]/95 backdrop-blur-sm border-b border-white/[0.1] px-4 py-2.5 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-1">
        {allListings.length > 1 && (
          <>
            <button
              onClick={() => navigate(-1)}
              disabled={currentIndex === 0}
              className="p-1.5 rounded-lg hover:bg-lift disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Previous listing"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-xs font-medium text-lo tabular-nums px-1">
              {currentIndex + 1} / {allListings.length}
            </span>
            <button
              onClick={() => navigate(1)}
              disabled={currentIndex === allListings.length - 1}
              className="p-1.5 rounded-lg hover:bg-lift disabled:opacity-30 disabled:pointer-events-none transition-colors"
              aria-label="Next listing"
            >
              <ChevronRight size={16} />
            </button>
          </>
        )}
      </div>
      <button
        onClick={onClose}
        className="p-1.5 rounded-full hover:bg-lift transition-colors"
        aria-label="Close"
      >
        <X size={18} className="text-md" />
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {/* Backdrop — desktop only */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm hidden md:block"
        onClick={onClose}
      />

      {/* Drop overlay */}
      {(dropActive || dropUploading) && (
        <div className="absolute inset-0 z-[60] flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-accent/10 backdrop-blur-[2px]" />
          <div className="relative z-10 bg-card rounded-2xl shadow-xl px-8 py-6 flex flex-col items-center gap-2">
            {dropUploading ? (
              <>
                <Loader2 size={28} className="animate-spin text-accent" />
                <p className="text-sm font-medium text-md">Uploading…</p>
              </>
            ) : (
              <>
                <ImagePlus size={28} className="text-accent" />
                <p className="text-sm font-medium text-md">Drop to upload</p>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── MOBILE layout: full-screen, carousel on top, details scroll below ── */}
      <div className="md:hidden absolute inset-0 bg-[#1C1E27]/80 backdrop-blur-2xl flex flex-col overflow-hidden">
        {topBar}

        {/* Mobile carousel */}
        {orderedMedia.length > 0 && (
          <div className="relative bg-panel h-64 shrink-0">
            <div className="overflow-hidden h-full" ref={emblaRef}>
              <div className="flex h-full">
                {orderedMedia.map((item, i) => (
                  <div key={i} className="relative flex-none w-full h-full">
                    {item.type === "video" ? (
                      <>
                        <video
                          src={item.src}
                          controls
                          className="w-full h-full object-contain"
                          preload="metadata"
                        />
                        <div className="absolute top-2 left-2 bg-black/60 rounded-full p-1 pointer-events-none">
                          <Play size={12} className="text-white fill-white" />
                        </div>
                      </>
                    ) : (
                      <Image
                        src={item.src}
                        alt={`${current.title} image ${i + 1}`}
                        fill
                        className="object-contain"
                        sizes="100vw"
                        priority={i === 0}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
            {orderedMedia.length > 1 && (
              <>
                <button onClick={scrollPrev} className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={scrollNext} className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/40 text-white">
                  <ChevronRight size={16} />
                </button>
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {orderedMedia.map((_, i) => (
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
        <div className="relative z-10 bg-[#141518]/80 backdrop-blur-2xl rounded-2xl w-full max-w-5xl max-h-[92vh] flex overflow-hidden border border-white/[0.1] shadow-[0_24px_60px_rgba(0,0,0,0.9)]">

          {/* Left column: stacked media, independent scroll */}
          <div className="w-[45%] shrink-0 bg-[#0F1013] overflow-y-auto flex flex-col border-r border-white/[0.08]">
            {orderedMedia.length > 0 ? (
              <div className="flex flex-col gap-2 p-2 flex-1">
                {orderedMedia.map((item, i) => (
                  item.type === "video" ? (
                    <video
                      key={i}
                      src={item.src}
                      controls
                      className="w-full rounded-lg"
                      preload="metadata"
                    />
                  ) : (
                    <Image
                      key={i}
                      src={item.src}
                      alt={`${current.title} image ${i + 1}`}
                      width={0}
                      height={0}
                      sizes="45vw"
                      className="w-full h-auto rounded-lg"
                      priority={i === 0}
                    />
                  )
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-lo text-sm">
                No images
              </div>
            )}
            <MediaUploader listingId={current.id} onUploadComplete={handleUploadComplete} />
          </div>

          {/* Right column: details, independent scroll */}
          <div className="flex-1 overflow-y-auto flex flex-col min-h-0 bg-[#1C1E27]">
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
      <span className="text-xs font-medium text-md block mb-1">{emoji} {label}</span>
      <div className="flex rounded-lg border border-white/25 overflow-hidden text-xs font-medium">
        {options.map(([val, lbl]) => (
          <button
            key={String(val)}
            onClick={() => onChange(val)}
            className={`px-3 py-1.5 transition-colors border-r border-white/15 last:border-r-0 ${
              value === val ? activeClass(val) : "bg-white/[0.06] text-hi/65 hover:bg-white/[0.12] hover:text-hi"
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
    <div className="flex items-center justify-between gap-4 px-4 py-2.5">
      <span className="flex items-center gap-2 text-xs font-medium text-lo shrink-0">
        {icon}
        {label}
      </span>
      <span className="text-sm text-hi text-right">{children}</span>
    </div>
  );
}
