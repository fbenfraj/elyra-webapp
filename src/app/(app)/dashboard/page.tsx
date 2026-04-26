import { SessionList } from "@/features/session/components/SessionList";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--content-wide)] flex-1 flex-col px-4 py-8 [&>*]:flex-1">
      <SessionList />
    </div>
  );
}
