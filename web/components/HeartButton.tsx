"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import type { Listing } from "@/types/listing.types";

interface Props {
  listing: Listing;
  onChange: (id: string, value: boolean) => void;
  field?: "hearted" | "hearted2";
  size?: number;
}

export default function HeartButton({ listing, onChange, field = "hearted", size = 15 }: Props) {
  const [value, setValue] = useState(listing[field] ?? false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !value;
    setValue(next);
    onChange(listing.id, next);
    await fetch("/api/heart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: listing.id, field, hearted: next }),
    });
  }

  const activeClass = field === "hearted2"
    ? "text-purple-500 fill-purple-500"
    : "text-red-500 fill-red-500";

  return (
    <button
      onClick={handleClick}
      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      title={value ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        size={size}
        className={value ? activeClass : "text-slate-300"}
      />
    </button>
  );
}
