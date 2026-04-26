"use client";

import { useState, useCallback } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Check, Upload, Loader, X } from "lucide-react";
import { ImageLightbox } from "@/features/generation/components/ImageLightbox";

const MAX_SELECTIONS = 5;

type ReferencePickerProps = {
  selectedIds: string[];
  onSelectionChange: (ids: string[]) => void;
};

export function ReferencePicker({
  selectedIds,
  onSelectionChange,
}: ReferencePickerProps) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [lightboxRef, setLightboxRef] = useState<{
    id: string;
    imageUrl: string;
    filename: string | null;
  } | null>(null);

  const { data: references, isLoading } = useQuery(
    trpc.reference.list.queryOptions()
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

  const toggleSelection = useCallback(
    (id: string) => {
      if (selectedIds.includes(id)) {
        onSelectionChange(selectedIds.filter((s) => s !== id));
      } else if (selectedIds.length < MAX_SELECTIONS) {
        onSelectionChange([...selectedIds, id]);
      }
    },
    [selectedIds, onSelectionChange]
  );

  const handleUpload = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setIsUploading(true);
      setUploadError(null);

      try {
        const fileArray = Array.from(files).slice(0, 5);
        let currentIds = [...selectedIds];

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

          const { id } = await confirmUpload.mutateAsync({
            r2Key,
            width: dimensions.width,
            height: dimensions.height,
            filename: file.name,
            fileSize: file.size,
          });

          if (currentIds.length < MAX_SELECTIONS) {
            currentIds = [...currentIds, id];
            onSelectionChange(currentIds);
          }
        }
      } catch (error) {
        console.error("Upload failed:", error);
        setUploadError("Upload failed. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [createUploadUrl, confirmUpload, selectedIds, onSelectionChange]
  );

  const selectedRefs =
    references?.filter((r) => selectedIds.includes(r.id)) ?? [];

  return (
    <div className="w-full">
      <ImageLightbox
        src={lightboxRef?.imageUrl ?? null}
        alt={lightboxRef?.filename ?? "Reference image"}
        isSelected={lightboxRef ? selectedIds.includes(lightboxRef.id) : false}
        onToggleSelect={
          lightboxRef ? () => toggleSelection(lightboxRef.id) : undefined
        }
        onClose={() => setLightboxRef(null)}
      />

      {/* Toggle row */}
      <div className="flex w-full items-center gap-2 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--background-elevated)]/60 px-4 py-2.5 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[#52525b] hover:text-[var(--foreground)]">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex flex-1 items-center gap-2"
        >
          <ImagePlus className="size-4" />
          {selectedIds.length > 0
            ? `${selectedIds.length} style reference${selectedIds.length !== 1 ? "s" : ""}`
            : "Add style references"}
        </button>
        {selectedIds.length > 0 && (
          <button
            type="button"
            onClick={() => onSelectionChange([])}
            className="rounded p-0.5 hover:bg-white/10"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      {/* Upload error */}
      {uploadError && (
        <p className="mt-2 text-xs text-red-400">{uploadError}</p>
      )}

      {/* Collapsed preview of selected thumbnails */}
      {!expanded && selectedRefs.length > 0 && (
        <div className="mt-2 flex gap-2">
          {selectedRefs.map((ref) => (
            <button
              key={ref.id}
              type="button"
              onClick={() =>
                setLightboxRef({
                  id: ref.id,
                  imageUrl: ref.imageUrl,
                  filename: ref.originalFilename,
                })
              }
              className="size-[120px] overflow-hidden rounded-md border border-[var(--border)] transition-opacity hover:opacity-80"
            >
              <img
                src={ref.imageUrl}
                alt={ref.originalFilename ?? "Reference"}
                className="h-full w-full object-cover"
              />
            </button>
          ))}
        </div>
      )}

      {/* Expanded picker */}
      {expanded && (
        <div className="mt-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)]/60 p-4">
          <p className="mb-3 text-xs text-[var(--foreground-subtle)]">
            {selectedIds.length}/{MAX_SELECTIONS} selected
          </p>

          {isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader className="size-4 animate-spin text-[var(--foreground-subtle)]" />
            </div>
          )}

          {!isLoading && references?.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-6 text-center">
              <p className="text-sm text-[var(--foreground-muted)]">
                No reference images yet
              </p>
              <label
                className={`flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-[var(--border)] px-6 py-6 transition-colors hover:border-[var(--foreground-subtle)] ${
                  isUploading ? "opacity-50" : ""
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <Loader className="size-5 animate-spin text-[var(--foreground-subtle)]" />
                ) : (
                  <>
                    <Upload className="size-5 text-[var(--foreground-subtle)]" />
                    <p className="text-xs text-[var(--foreground-subtle)]">
                      Drop images here or click to upload
                    </p>
                  </>
                )}
              </label>
              <p className="text-xs text-[var(--foreground-subtle)]">
                Or link a Spotify artist in Settings
              </p>
            </div>
          )}

          {references && references.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {references.map((ref) => {
                const isSelected = selectedIds.includes(ref.id);
                return (
                  <div key={ref.id} className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setLightboxRef({
                          id: ref.id,
                          imageUrl: ref.imageUrl,
                          filename: ref.originalFilename,
                        })
                      }
                      className={`overflow-hidden rounded-lg transition-all ${
                        isSelected
                          ? "ring-2 ring-white ring-offset-2 ring-offset-[#09090b]"
                          : "opacity-70 hover:opacity-100"
                      }`}
                    >
                      <div className="size-[120px]">
                        <img
                          src={ref.imageUrl}
                          alt={ref.originalFilename ?? "Reference"}
                          className="h-full w-full object-cover"
                        />
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleSelection(ref.id);
                      }}
                      className={`absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full transition-colors ${
                        isSelected
                          ? "bg-white text-[#09090b]"
                          : "bg-black/50 text-white/70 hover:bg-black/70 hover:text-white"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="size-3.5" />
                      ) : (
                        <span className="size-3.5 rounded-full border-2 border-current" />
                      )}
                    </button>

                    {/* Source badge */}
                    <span className="absolute bottom-1 left-1 rounded-full bg-black/60 px-1.5 py-0.5 text-[8px] font-medium text-white">
                      {ref.source.startsWith("spotify") ? "S" : "U"}
                    </span>
                  </div>
                );
              })}

              {/* Upload button */}
              <label
                className={`flex size-[120px] flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-[var(--border)] transition-colors hover:border-[var(--foreground-subtle)] ${
                  isUploading ? "opacity-50" : ""
                }`}
              >
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => handleUpload(e.target.files)}
                  disabled={isUploading}
                />
                {isUploading ? (
                  <Loader className="size-4 animate-spin text-[var(--foreground-subtle)]" />
                ) : (
                  <>
                    <Upload className="size-4 text-[var(--foreground-subtle)]" />
                    <span className="text-[9px] text-[var(--foreground-subtle)]">
                      + Upload
                    </span>
                  </>
                )}
              </label>
            </div>
          )}
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
