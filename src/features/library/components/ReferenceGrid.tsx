"use client";

import { useState, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Download, Trash2, Upload, ImageIcon, Loader } from "lucide-react";

export function ReferenceGrid() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isUploading, setIsUploading] = useState(false);

  const { data, isLoading } = useQuery(trpc.reference.list.queryOptions());

  const deleteRef = useMutation(
    trpc.reference.delete.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.reference.list.queryKey(),
        });
      },
    })
  );

  const createUploadUrl = useMutation(
    trpc.reference.createUploadUrl.mutationOptions()
  );

  const confirmUpload = useMutation(
    trpc.reference.confirmUpload.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.reference.list.queryKey(),
        });
      },
    })
  );

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setIsUploading(true);

      try {
        const fileArray = Array.from(files).slice(0, 5);

        for (const file of fileArray) {
          const { uploadUrl, r2Key } = await createUploadUrl.mutateAsync({
            filename: file.name,
            contentType: file.type,
            fileSize: file.size,
          });

          await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type },
          });

          const dimensions = await getImageDimensions(file);

          await confirmUpload.mutateAsync({
            r2Key,
            width: dimensions.width,
            height: dimensions.height,
            filename: file.name,
            fileSize: file.size,
          });
        }
      } catch (error) {
        console.error("Upload failed:", error);
      } finally {
        setIsUploading(false);
      }
    },
    [createUploadUrl, confirmUpload]
  );

  const handleDownload = (imageUrl: string, filename: string | null) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = filename ?? "reference.jpg";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Upload dropzone */}
      <label className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] px-6 py-8 transition-colors hover:border-[var(--foreground-subtle)]">
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => handleUpload(e.target.files)}
          disabled={isUploading}
        />
        {isUploading ? (
          <>
            <Loader className="size-6 animate-spin text-[var(--foreground-subtle)]" />
            <p className="text-sm text-[var(--foreground-muted)]">Uploading...</p>
          </>
        ) : (
          <>
            <Upload className="size-6 text-[var(--foreground-subtle)]" />
            <p className="text-sm text-[var(--foreground-muted)]">
              Drop images here or click to browse
            </p>
            <p className="text-xs text-[var(--foreground-subtle)]">
              JPEG, PNG, or WebP. Max 10MB each, up to 5 at a time.
            </p>
          </>
        )}
      </label>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="size-5 animate-spin text-[var(--foreground-subtle)]" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--background-elevated)]">
            <ImageIcon className="size-7 text-[var(--foreground-subtle)]" />
          </div>
          <p className="text-[var(--foreground-muted)]">No reference images yet</p>
          <p className="text-sm text-[var(--foreground-subtle)]">
            Upload your own artwork or link a Spotify artist in Settings.
          </p>
        </div>
      )}

      {/* Grid */}
      {data && data.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.map((ref) => (
            <div
              key={ref.id}
              className="group relative overflow-hidden rounded-lg border border-transparent bg-[var(--background-elevated)] transition-colors hover:border-[var(--border)]"
            >
              <div className="aspect-square">
                <img
                  src={ref.imageUrl}
                  alt={ref.originalFilename ?? "Reference"}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Source badge */}
              <div className="absolute left-2 top-2">
                <span className="rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-medium text-white">
                  {ref.source.startsWith("spotify") ? "Spotify" : "Uploaded"}
                </span>
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={() => handleDownload(ref.imageUrl, ref.originalFilename)}
                    className="rounded-md bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                  >
                    <Download className="size-3.5" />
                  </button>
                  <button
                    onClick={() => deleteRef.mutate({ referenceId: ref.id })}
                    className="rounded-md bg-black/50 p-1.5 text-white transition-colors hover:bg-red-600/80"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </div>
                {ref.originalFilename && (
                  <p className="truncate text-xs text-white/80">
                    {ref.originalFilename}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function getImageDimensions(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
