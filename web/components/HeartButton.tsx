"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import type { Listing } from "@/types/listing.types";

interface Props {
  listing: Listing;
  onChange: (id: string, hearted: boolean) => void;
  size?: number;
}

export default function HeartButton({ listing, onChange, size = 15 }: Props) {
  const [hearted, setHearted] = useState(listing.hearted ?? false);

  async function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !hearted;
    setHearted(next);
    onChange(listing.id, next);
    await fetch("/api/heart", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: listing.id, hearted: next }),
    });
  }

  return (
    <button
      onClick={handleClick}
      className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
      title={hearted ? "Remove from favorites" : "Add to favorites"}
    >
      <Heart
        size={size}
        className={hearted ? "text-red-500 fill-red-500" : "text-slate-300"}
      />
    </button>
  );
}
