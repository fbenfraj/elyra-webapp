import { LibraryTabs } from "@/features/library/components/LibraryTabs";

export default function LibraryPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--content-medium)] flex-1 flex-col py-8">
      <LibraryTabs />
    </div>
  );
}
