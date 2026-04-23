export default function OperatorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-6xl px-[var(--space-4)] py-[var(--space-8)]">
      <h1 className="text-2xl font-semibold text-[var(--foreground)]">
        Operator Dashboard
      </h1>
      <p className="mt-1 text-sm text-[var(--foreground-muted)]">
        Pipeline metrics and cost tracking
      </p>
      <div className="mt-[var(--space-6)]">{children}</div>
    </div>
  );
}
