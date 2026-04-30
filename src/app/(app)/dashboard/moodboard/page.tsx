import Link from "next/link";
import {
  ArrowLeft,
  SwatchBook,
  Layers,
  Shirt,
  Mountain,
  Image as ImageIcon,
  Type,
} from "lucide-react";

type Option = {
  key: string;
  title: string;
  description: string;
  icon: typeof SwatchBook;
  href: string | null;
};

const OPTIONS: Option[] = [
  {
    key: "palette",
    title: "Palette",
    description: "Lock in the 5 colors that anchor every cover.",
    icon: SwatchBook,
    href: "/dashboard/moodboard/palette",
  },
  {
    key: "textures",
    title: "Textures",
    description: "Choose the surface qualities — matte, glossy, grainy, woven — that live behind your colors.",
    icon: Layers,
    href: null,
  },
  {
    key: "styling",
    title: "Styling",
    description: "Define wardrobe, accessories, and makeup — how you show up on every cover.",
    icon: Shirt,
    href: null,
  },
  {
    key: "decors",
    title: "Décors",
    description: "Choose the environments and sets that frame your world.",
    icon: Mountain,
    href: null,
  },
  {
    key: "photo-references",
    title: "Photo references",
    description: "Curate reference photos, then dial them into your palette.",
    icon: ImageIcon,
    href: null,
  },
  {
    key: "typography",
    title: "Typography",
    description: "Pick the typefaces that carry your name on every release.",
    icon: Type,
    href: null,
  },
];

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
          const isActive = opt.href !== null;
          const baseClass =
            "relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--background-overlay)]/30 p-6 transition-colors";
          const inactiveClass = "opacity-70";
          const activeClass = "hover:border-violet-500/40 hover:bg-[var(--background-overlay)]/50";

          const content = (
            <>
              <div className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                <Icon className="size-5 text-violet-400" />
              </div>
              <h3 className="mt-4 text-base font-semibold text-[var(--foreground)]">
                {opt.title}
              </h3>
              <p className="mt-1.5 text-sm text-[var(--foreground-muted)]">
                {opt.description}
              </p>
              {!isActive && (
                <span className="absolute right-4 top-4 rounded-full bg-white/6 px-2.5 py-0.5 text-[11px] font-medium text-[var(--foreground-subtle)]">
                  Coming soon
                </span>
              )}
            </>
          );

          if (isActive && opt.href) {
            return (
              <Link
                key={opt.key}
                href={opt.href}
                className={`${baseClass} ${activeClass}`}
              >
                {content}
              </Link>
            );
          }

          return (
            <div key={opt.key} className={`${baseClass} ${inactiveClass}`}>
              {content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
