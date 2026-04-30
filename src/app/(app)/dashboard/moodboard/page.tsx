import Link from "next/link";
import {
  ArrowLeft,
  SwatchBook,
  Shirt,
  Mountain,
  Image as ImageIcon,
  Type,
} from "lucide-react";

const OPTIONS = [
  {
    key: "palette",
    title: "Palette",
    description: "Lock in your colors and textures — the visual atoms behind every generation.",
    icon: SwatchBook,
  },
  {
    key: "styling",
    title: "Styling",
    description: "Define wardrobe, accessories, and makeup — how you show up on every cover.",
    icon: Shirt,
  },
  {
    key: "decors",
    title: "Décors",
    description: "Choose the environments and sets that frame your world.",
    icon: Mountain,
  },
  {
    key: "photo-references",
    title: "Photo references",
    description: "Curate reference photos, then dial them into your palette.",
    icon: ImageIcon,
  },
  {
    key: "typography",
    title: "Typography",
    description: "Pick the typefaces that carry your name on every release.",
    icon: Type,
  },
] as const;

export default function MoodboardHubPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--content-medium)] flex-1 flex-col py-8">
      <Link
        href="/dashboard"
        className="mb-6 inline-flex w-fit items-center gap-1.5 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="size-3.5" />
        Back to dashboard
      </Link>

      <div className="mb-8">
        <p className="text-xs font-medium uppercase tracking-widest text-violet-400/80">
          Moodboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-[var(--foreground)]">
          Build your visual world
        </h1>
        <p className="mt-2 max-w-xl text-sm text-[var(--foreground-muted)]">
          Your moodboard is a set of pieces you assemble over time — each one shapes how every future generation looks.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {OPTIONS.map((opt) => {
          const Icon = opt.icon;
          return (
            <div
              key={opt.key}
              className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background-overlay)]/30 p-6 opacity-70"
            >
              <div className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <Icon className="size-5 text-violet-400" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">
                {opt.title}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--foreground-muted)]">
                {opt.description}
              </p>
              <span className="absolute right-4 top-4 rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
                Coming soon
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
