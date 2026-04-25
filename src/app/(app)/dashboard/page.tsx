import { SessionList } from "@/features/session/components/SessionList";

export default function DashboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-[var(--content-medium)] flex-1 flex-col py-8 [&>*]:flex-1">
      <SessionList />
    </div>
  );
}
