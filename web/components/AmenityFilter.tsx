"use client";

import * as Popover from "@radix-ui/react-popover";
import { SlidersHorizontal, X } from "lucide-react";
import { AMENITY_DEFINITIONS } from "@/hooks/useAmenities";

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
              ? "bg-blue-600 text-white border-blue-600 hover:bg-blue-700"
              : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:text-slate-800"
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
          align="start"
          sideOffset={6}
          className="z-50 w-64 rounded-2xl border border-slate-200 bg-white shadow-xl animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Filter by amenity
            </span>
            {count > 0 && (
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="text-[11px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
              >
                Clear all
              </button>
            )}
          </div>

          {/* Checkboxes */}
          <div className="py-2 max-h-72 overflow-y-auto">
            {AMENITY_DEFINITIONS.map(({ label, emoji }) => {
              const checked = value.has(label);
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => toggle(label)}
                  className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left ${
                    checked ? "bg-blue-50 text-blue-700" : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {/* Custom checkbox */}
                  <span
                    className={`flex-none w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                      checked
                        ? "bg-blue-600 border-blue-600"
                        : "border-slate-300 bg-white"
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

          <Popover.Arrow className="fill-white drop-shadow-sm" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
