import type { Listing } from "@/types/listing.types";

export type AmenityDef = {
  label: string;
  emoji: string;
  match: (listing: Listing) => boolean;
};

/**
 * Single source of truth for every amenity.
 * Merges scraped (unit_details regex) and inferred fields so both the table
 * column and the filter dropdown use identical logic.
 */
export const AMENITY_DEFINITIONS: AmenityDef[] = [
  {
    label: "In-unit Laundry",
    emoji: "🧺",
    match: (l) =>
      (l.unit_details ?? []).some((d) => /in.unit laundry/i.test(d)) ||
      l.inferred?.hasWasherDryer === true,
  },
  {
    label: "W/D Hookups",
    emoji: "🔌",
    match: (l) =>
      (l.unit_details ?? []).some((d) => /washer.*dryer.*hook/i.test(d)) ||
      l.inferred?.hasWasherDryerInHookUps === true,
  },
  {
    label: "Building Laundry",
    emoji: "🏢",
    match: (l) =>
      (l.unit_details ?? []).some((d) => /laundry in building/i.test(d)),
  },
  {
    label: "Parking",
    emoji: "🚗",
    match: (l) =>
      (l.unit_details ?? []).some((d) => /parking/i.test(d)) ||
      l.inferred?.parking === true,
  },
  { label: "Pool",            emoji: "🏊",  match: (l) => l.inferred?.pool === true },
  { label: "Gym",             emoji: "💪",  match: (l) => l.inferred?.gym === true },
  { label: "Elevator",        emoji: "🛗",  match: (l) => l.inferred?.elevator === true },
  { label: "WiFi",            emoji: "📶",  match: (l) => l.inferred?.wifi === true },
  { label: "Terrace",         emoji: "🌿",  match: (l) => l.inferred?.terrace === true },
  { label: "Jacuzzi",         emoji: "🛁",  match: (l) => l.inferred?.jacuzzi === true },
  { label: "Security",        emoji: "🔒",  match: (l) => l.inferred?.security === true },
  { label: "Furnished",       emoji: "🛋️", match: (l) => l.inferred?.hasFurniture === true },
  { label: "Needs Cosigner",  emoji: "📝",  match: (l) => l.inferred?.requiresCosigner === true },
];

/** Returns the amenities a listing has, in definition order, deduped. */
export function getListingAmenities(listing: Listing): { label: string; emoji: string }[] {
  return AMENITY_DEFINITIONS
    .filter(({ match }) => match(listing))
    .map(({ label, emoji }) => ({ label, emoji }));
}
