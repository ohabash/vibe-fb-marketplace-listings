"use client";

import { useRef, useState } from "react";
import { Loader2, ImagePlus } from "lucide-react";
import { uploadMedia } from "@/lib/uploadMedia";

interface Props {
  listingId: string;
  onUploadComplete: (images: string[], videos: string[]) => void;
}

export default function MediaUploader({ listingId, onUploadComplete }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | File[] | null) {
    if (!files || !Array.from(files).length) return;
    setUploading(true);
    setError(null);
    try {
      const { images, videos } = await uploadMedia(listingId, Array.from(files));
      onUploadComplete(images, videos);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="px-2 pb-2">
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 text-xs font-medium text-lo hover:text-md border border-dashed border-white/[0.1] hover:border-white/20 rounded-xl py-2.5 transition-colors disabled:opacity-50"
      >
        {uploading ? (
          <><Loader2 size={13} className="animate-spin" /> Uploading…</>
        ) : (
          <><ImagePlus size={13} /> Add photos / videos</>
        )}
      </button>
      {error && <p className="text-xs text-red-400 mt-1 text-center">{error}</p>}
    </div>
  );
}
