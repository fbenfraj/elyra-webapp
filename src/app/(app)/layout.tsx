import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Header } from "@/components/layout/Header";
import { OnboardingGate } from "@/features/onboarding/components/OnboardingGate";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header email={user.email ?? ""} />
      <main className="flex flex-1 flex-col px-4 md:px-8">
        <OnboardingGate>{children}</OnboardingGate>
      </main>
    </div>
  );
}
