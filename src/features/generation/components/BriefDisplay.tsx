export function BriefDisplay({ text }: { text: string }) {
  return (
    <div className="mx-auto w-full max-w-[var(--content-narrow)]">
      <p className="text-sm text-[var(--foreground-muted)]">Your brief</p>
      <p className="mt-1 text-base text-[var(--foreground)]">{text}</p>
    </div>
  );
}
