"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import { motion } from "motion/react";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { MessageQuiz } from "@/features/message/components/MessageQuiz";
import { MessageReveal } from "@/features/message/components/MessageReveal";
import type {
  MessageInputs,
  MessageOutput,
  MessageQuestions,
} from "@/lib/schemas/message";

type Step =
  | "intro"
  | "loading-questions"
  | "quiz"
  | "synthesizing"
  | "reveal";

export function MessageFlow() {
  const trpc = useTRPC();
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [questions, setQuestions] = useState<MessageQuestions | null>(null);
  const [bufferedInputs, setBufferedInputs] = useState<MessageInputs | null>(
    null
  );
  const [output, setOutput] = useState<MessageOutput | null>(null);

  const generateQuestions = useMutation(
    trpc.message.generateQuestions.mutationOptions({
      onSuccess: (data) => {
        setQuestions(data);
        setStep("quiz");
      },
      onError: () => {
        toast.error("Couldn't load the questions. Try again.");
        setStep("intro");
      },
    })
  );

  const submitAnswers = useMutation(
    trpc.message.submitAnswers.mutationOptions({
      onSuccess: (data) => {
        setOutput(data.output);
        setStep("reveal");
      },
      onError: () => {
        toast.error("Couldn't craft the message. Try again.");
        setStep("quiz");
      },
    })
  );

  useEffect(() => {
    if (step === "loading-questions" && !generateQuestions.isPending) {
      generateQuestions.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  function start() {
    setStep("loading-questions");
  }

  function handleQuizComplete(inputs: MessageInputs) {
    setBufferedInputs(inputs);
    setStep("synthesizing");
    submitAnswers.mutate({ inputs });
  }

  function retrySynthesis() {
    if (!bufferedInputs) return;
    setStep("synthesizing");
    submitAnswers.mutate({ inputs: bufferedInputs });
  }

  if (step === "intro") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full text-center"
      >
        <Sparkles className="mx-auto mb-4 size-10 text-indigo-300" />
        <h1 className="text-3xl font-semibold tracking-tight text-white">
          Discover your message
        </h1>
        <p className="mx-auto mt-4 max-w-lg text-sm text-zinc-400">
          A few playful questions about your music and identity. We&apos;ll turn
          your answers into the foundation for every visual we generate. Takes
          about 3 minutes.
        </p>
        <div className="mt-8 flex items-center justify-center">
          <Button onClick={start}>Start</Button>
        </div>
      </motion.div>
    );
  }

  if (step === "loading-questions" || step === "synthesizing") {
    const copy =
      step === "loading-questions"
        ? "Tuning the questions to your sound…"
        : "Crafting your message…";
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center gap-4 text-center"
      >
        <Loader2 className="size-8 animate-spin text-indigo-300" />
        <p className="text-sm text-zinc-400">{copy}</p>
        {step === "synthesizing" && submitAnswers.isError && (
          <Button variant="ghost-secondary" onClick={retrySynthesis}>
            Try again
          </Button>
        )}
      </motion.div>
    );
  }

  if (step === "quiz" && questions) {
    return (
      <MessageQuiz questions={questions} onComplete={handleQuizComplete} />
    );
  }

  if (step === "reveal" && output) {
    return (
      <MessageReveal
        output={output}
        onContinue={() => router.push("/dashboard")}
      />
    );
  }

  return null;
}
