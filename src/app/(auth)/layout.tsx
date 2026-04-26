import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen overflow-hidden">
      {/* Mobile background (visible < lg) */}
      <div
        id="auth-illustration-mobile"
        className="absolute inset-0 lg:hidden"
      />

      {/* Desktop illustration panel (visible >= lg) */}
      <div
        id="auth-illustration-desktop"
        className="relative hidden w-1/2 overflow-hidden lg:block"
      />

      {/* Form panel */}
      <div className="relative z-10 flex w-full flex-col items-center justify-center px-6 py-12 lg:w-1/2">
        <div className="w-full max-w-[400px]">
          <div className="mb-10 flex flex-col items-center gap-3">
            <Image
              src="/elyra-logo-no-bg.png"
              alt="Elyra"
              width={160}
              height={160}
              className="rounded-sm"
              priority
            />
            <span className="text-base font-semibold uppercase tracking-[0.12em] text-foreground">
              elyra
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}
