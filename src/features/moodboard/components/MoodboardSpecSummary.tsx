import type { MoodboardSpec } from "@/lib/schemas/moodboard";

export function MoodboardSpecSummary({ spec }: { spec: MoodboardSpec }) {
  return (
    <>
      <div>
        <p className="text-sm font-medium text-zinc-300">{spec.coreIdea}</p>
        <p className="mt-1 text-xs text-zinc-500 italic">{spec.duality}</p>
        <p className="mt-4 text-sm leading-relaxed text-zinc-400">
          {spec.narrative}
        </p>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex gap-1.5">
          {spec.palette.map((hex, i) => (
            <div
              key={i}
              className="size-7 rounded-lg border border-zinc-700/50"
              style={{ backgroundColor: hex }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {spec.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full bg-white/8 px-2.5 py-0.5 text-[11px] text-zinc-500"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </>
  );
}
