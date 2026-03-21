export async function uploadMedia(
  id: string,
  files: File[]
): Promise<{ images: string[]; videos: string[] }> {
  const formData = new FormData();
  formData.append("id", id);
  for (const file of files) formData.append("files", file);
  const res = await fetch("/api/upload-media", { method: "POST", body: formData });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Upload failed");
  return { images: data.images, videos: data.videos };
}
