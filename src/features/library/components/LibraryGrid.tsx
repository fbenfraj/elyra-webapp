"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LibraryFilters } from "@/features/library/components/LibraryFilters";
import { ImageLightbox } from "@/features/library/components/ImageLightbox";
import { Star, Download, Loader, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type FilterState = {
  sessionId?: string;
  favoritedOnly: boolean;
  since: "7d" | "30d" | "all";
};

export function LibraryGrid() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<FilterState>({
    favoritedOnly: false,
    since: "all",
  });
  const [page, setPage] = useState(1);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const { data, isLoading } = useQuery(
    trpc.library.list.queryOptions({
      sessionId: filters.sessionId,
      favoritedOnly: filters.favoritedOnly,
      since: filters.since,
      page,
    })
  );

  // Fetch sessions for the filter dropdown
  const { data: sessionsData } = useQuery(
    trpc.session.list.queryOptions()
  );

  const toggleFavorite = useMutation(
    trpc.library.toggleFavorite.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.library.list.queryKey(),
        });
      },
    })
  );

  const deleteImage = useMutation(
    trpc.library.delete.mutationOptions({
      onSuccess: () => {
        setLightboxImage(null);
        queryClient.invalidateQueries({
          queryKey: trpc.library.list.queryKey(),
        });
      },
    })
  );

  const handleDownload = async (attemptId: string) => {
    const img = data?.images.find((i) => i.id === attemptId);
    if (!img) return;

    const link = document.createElement("a");
    link.href = img.imageUrl;
    link.download = `elyra-${attemptId}.webp`;
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const totalPages = data ? Math.ceil(data.total / 24) : 0;
  const currentImage = data?.images.find((i) => i.id === lightboxImage) ?? null;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        {data && (
          <p className="text-sm text-foreground-muted">
            {data.total} image{data.total !== 1 ? "s" : ""}
          </p>
        )}
      </div>

      {/* Filters */}
      <LibraryFilters
        filters={filters}
        onFilterChange={(f) => {
          setFilters(f);
          setPage(1);
        }}
        sessions={
          sessionsData?.map((s) => ({
            id: s.id,
            briefText: s.briefText,
          })) ?? []
        }
      />

      {/* Loading state */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader className="size-5 animate-spin text-foreground-subtle" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && data?.images.length === 0 && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-background-elevated">
            <ImageIcon className="size-7 text-foreground-subtle" />
          </div>
          <p className="text-foreground-muted">
            {filters.favoritedOnly
              ? "No favorited images yet"
              : "No images generated yet"}
          </p>
          <p className="text-sm text-foreground-subtle">
            {filters.favoritedOnly
              ? "Star images to find them here"
              : "Start a session to create your first images"}
          </p>
        </div>
      )}

      {/* Grid */}
      {data && data.images.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {data.images.map((image) => (
            <div
              key={image.id}
              className="group relative cursor-pointer overflow-hidden rounded-lg border border-transparent bg-background-elevated transition-colors hover:border-border"
              onClick={() => setLightboxImage(image.id)}
            >
              <div className="aspect-square">
                <img
                  src={image.imageUrl}
                  alt={image.sessionBrief}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Hover overlay */}
              <div className="absolute inset-0 flex flex-col justify-between bg-black/0 p-2 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
                <div className="flex justify-end gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleFavorite.mutate({ attemptId: image.id });
                    }}
                    className="rounded-md bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                  >
                    <Star
                      className={`size-3.5 ${image.favorited ? "fill-yellow-500 text-yellow-500" : ""}`}
                    />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(image.id);
                    }}
                    className="rounded-md bg-black/50 p-1.5 text-white transition-colors hover:bg-black/70"
                  >
                    <Download className="size-3.5" />
                  </button>
                </div>
                <p className="truncate text-xs text-white/80">
                  {image.sessionBrief.slice(0, 30)}
                </p>
              </div>

              {/* Favorite indicator (always visible) */}
              {image.favorited && (
                <div className="absolute left-2 top-2">
                  <Star className="size-3.5 fill-yellow-500 text-yellow-500 drop-shadow" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-foreground-muted">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="ghost"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage(page + 1)}
          >
            Next
          </Button>
        </div>
      )}

      {/* Lightbox */}
      <ImageLightbox
        image={currentImage}
        onClose={() => setLightboxImage(null)}
        onToggleFavorite={(id) => toggleFavorite.mutate({ attemptId: id })}
        onDelete={(id) => deleteImage.mutate({ attemptId: id })}
        onDownload={handleDownload}
      />
    </div>
  );
}
