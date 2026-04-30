"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { useMutation } from "@tanstack/react-query";
import { ArrowRight, Loader2, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  MESSAGE_SECTION_KEYS,
  type MessageOutput,
  type MessageSectionKey,
} from "@/lib/schemas/message";

type Props = {
  output: MessageOutput;
  onContinue: () => void;
};

const SECTION_LABELS: Record<MessageSectionKey, string> = {
  narrative: "Narrative",
  inspiration: "Inspiration",
  visualDirection: "Visual direction",
  authenticity: "Authenticity & emotion",
  aesthetic: "Aesthetic",
};

export function MessageReveal({ output: initialOutput, onContinue }: Props) {
  const trpc = useTRPC();
  const [output, setOutput] = useState<MessageOutput>(initialOutput);
  const [stepIndex, setStepIndex] = useState(0);
  const [isEditing, setIsEditing] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");

  const regenerate = useMutation(
    trpc.message.regenerateSection.mutationOptions({
      onSuccess: (data) => {
        setOutput(data);
        setIsEditing(false);
        setFeedbackText("");
      },
      onError: () => {
        toast.error("Couldn't regenerate that section. Try again.");
      },
    })
  );

  const total = MESSAGE_SECTION_KEYS.length;
  const isDone = stepIndex >= total;
  const currentKey: MessageSectionKey | null = isDone
    ? null
    : MESSAGE_SECTION_KEYS[stepIndex];

  function accept() {
    setIsEditing(false);
    setFeedbackText("");
    setStepIndex((i) => i + 1);
  }

  function submitFeedback() {
    if (!currentKey || !feedbackText.trim()) return;
    regenerate.mutate({
      sectionKey: currentKey,
      feedback: feedbackText.trim(),
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full"
    >
      <p className="text-center text-xs font-medium uppercase tracking-widest text-indigo-300/80">
        Your message
      </p>
      <h1 className="mt-2 text-center text-4xl font-semibold tracking-tight text-white">
        {output.title}
      </h1>

      {/* Progress dots */}
      <div className="mt-6 flex items-center justify-center gap-1.5">
        {MESSAGE_SECTION_KEYS.map((_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full transition-colors ${
              i < stepIndex
                ? "bg-indigo-400"
                : i === stepIndex
                  ? "bg-indigo-300"
                  : "bg-zinc-700"
            }`}
          />
        ))}
      </div>

      <div className="mx-auto mt-8 max-w-2xl">
        <AnimatePresence mode="wait">
          {currentKey ? (
            <motion.div
              key={currentKey}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6"
            >
              <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                {SECTION_LABELS[currentKey]}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-zinc-200">
                {output[currentKey]}
              </p>

              {isEditing ? (
                <div className="mt-5 flex flex-col gap-2">
                  <textarea
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    placeholder="What should change? e.g. make it punchier, less lyrical, lean more on the visual side…"
                    rows={3}
                    maxLength={500}
                    disabled={regenerate.isPending}
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none disabled:opacity-60"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost-secondary"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setFeedbackText("");
                      }}
                      disabled={regenerate.isPending}
                    >
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      onClick={submitFeedback}
                      disabled={
                        !feedbackText.trim() || regenerate.isPending
                      }
                    >
                      {regenerate.isPending && (
                        <Loader2 className="size-3.5 animate-spin" />
                      )}
                      Regenerate
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-5 flex items-center justify-end gap-2">
                  <Button
                    variant="ghost-secondary"
                    size="sm"
                    onClick={() => setIsEditing(true)}
                  >
                    <Pencil className="size-3.5" />
                    Tweak
                  </Button>
                  <Button size="sm" onClick={accept}>
                    <Check className="size-3.5" />
                    Looks good
                  </Button>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {MESSAGE_SECTION_KEYS.map((key) => (
                <div key={key}>
                  <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
                    {SECTION_LABELS[key]}
                  </p>
                  <p className="mt-1.5 text-sm leading-relaxed text-zinc-200">
                    {output[key]}
                  </p>
                </div>
              ))}

              <p className="pt-2 text-center text-xs text-zinc-500">
                You can edit this anytime in your profile.
              </p>

              <div className="flex items-center justify-center">
                <Button onClick={onContinue}>
                  Go to dashboard
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
