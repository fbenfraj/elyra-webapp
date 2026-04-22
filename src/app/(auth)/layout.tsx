export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground">
            elyra
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
