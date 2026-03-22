"use client";

import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X } from "lucide-react";
import { ALL_FILTER_AMENITIES } from "@/hooks/useAmenities";

interface Props {
  value: Set<string>;
  onChange: (v: Set<string>) => void;
}

export default function AmenityFilter({ value, onChange }: Props) {
  const count = value.size;

  function toggle(label: string) {
    const next = new Set(value);
    if (next.has(label)) next.delete(label);
    else next.add(label);
    onChange(next);
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className={`relative flex items-center gap-1.5 text-sm font-medium rounded-xl px-3 py-1.5 border transition-colors shadow-sm shrink-0 ${
            count > 0
              ? "bg-violet-600 text-white border-violet-600 hover:bg-violet-500"
              : "bg-card text-md border-white/[0.08] hover:border-white/15 hover:text-hi"
          }`}
        >
          <SlidersHorizontal size={14} />
          <span className="hidden sm:inline">Amenities</span>
          {count > 0 && (
            <span className="ml-0.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-white/25 text-[10px] font-bold leading-none">
              {count}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          side="bottom"
          align="end"
          sideOffset={6}
          className="z-[9999] w-64 rounded-2xl border border-white/10 bg-card/80 backdrop-blur-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.08]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-lo">
              Filter by amenity
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11px] font-medium text-violet-400 hover:text-violet-300 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Checkboxes */}
          <div className="py-1 max-h-[60vh] sm:max-h-72 overflow-y-auto">
            {ALL_FILTER_AMENITIES.map(({ label, emoji }) => {
              const checked = value.has(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggle(label)}
                  className={`w-full flex items-center gap-3 px-4 py-3 sm:py-2 text-sm transition-colors text-left ${
                    checked ? "bg-violet-500/10 text-violet-300" : "text-md hover:bg-lift"
                  }`}
                >
                  {/* Custom checkbox */}
                  <span
                    className={`flex-none w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      checked
                        ? "bg-violet-500 border-violet-500"
                        : "border-white/20 bg-card"
                    }`}
                  >
                    {checked && (
                      <X size={9} strokeWidth={3} className="text-white" />
                    )}
                  </span>
                  <span className="text-base leading-none">{emoji}</span>
                  <span className="font-medium">{label}</span>
                </button>
              );
            })}
          </div>

          <Popover.Arrow className="fill-[#1E2028] drop-shadow-sm" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
