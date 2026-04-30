import { PaletteFlow } from "@/features/palette/components/PaletteFlow";

export default function PalettePage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--content-medium)] flex-1 flex-col py-8">
      <PaletteFlow />
    </div>
  );
}
