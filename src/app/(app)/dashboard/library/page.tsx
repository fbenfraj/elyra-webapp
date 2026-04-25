import { LibraryGrid } from "@/features/library/components/LibraryGrid";

export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--content-medium)] flex-1 flex-col py-8">
      <LibraryGrid />
    </div>
  );
}
