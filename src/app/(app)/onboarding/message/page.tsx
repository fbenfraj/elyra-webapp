import { MessageFlow } from "@/features/message/components/MessageFlow";

export default function OnboardingMessagePage() {
  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-3xl flex-col items-center justify-center px-6 py-12">
      <MessageFlow />
    </div>
  );
}
