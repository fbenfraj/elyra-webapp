"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ArrowRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import type {
  MessageInputs,
  MessageQuestion,
  MessageQuestions,
  MessageSignal,
} from "@/lib/schemas/message";

type Answer = string | string[];

type Props = {
  questions: MessageQuestions;
  onComplete: (inputs: MessageInputs) => void;
};

const ARRAY_SIGNALS = new Set<MessageSignal>([
  "emotions",
  "values",
  "themes",
  "influences",
  "visualWorld",
  "identityTraits",
]);

function isMulti(q: MessageQuestion): boolean {
  return q.type === "multi";
}

function answerForSignal(
  signal: MessageSignal,
  answer: Answer | undefined
): string | string[] | undefined {
  if (answer === undefined) return undefined;
  if (ARRAY_SIGNALS.has(signal)) {
    return Array.isArray(answer) ? answer : [answer];
  }
  return Array.isArray(answer) ? answer.join(", ") : answer;
}

export function MessageQuiz({ questions, onComplete }: Props) {
  const [index, setIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, Answer>>({});
  const [otherText, setOtherText] = useState("");
  const [showOther, setShowOther] = useState(false);

  const q = questions.questions[index];
  const total = questions.questions.length;

  const current = answers[q.signal];
  const canAdvance = (() => {
    if (q.type === "text") return true;
    if (q.type === "single")
      return typeof current === "string" && current.length > 0;
    if (q.type === "multi") return Array.isArray(current) && current.length > 0;
    return false;
  })();
  const isLast = index === total - 1;
  const isEmptyText = q.type === "text" && !otherText.trim();

  function pickSingle(label: string) {
    setAnswers((a) => ({ ...a, [q.signal]: label }));
    setShowOther(false);
    setOtherText("");
  }

  function toggleMulti(label: string) {
    const max = q.maxSelections ?? 5;
    setAnswers((a) => {
      const arr = Array.isArray(a[q.signal]) ? (a[q.signal] as string[]) : [];
      if (arr.includes(label)) {
        return { ...a, [q.signal]: arr.filter((x) => x !== label) };
      }
      if (arr.length >= max) return a;
      return { ...a, [q.signal]: [...arr, label] };
    });
  }

  function commitOther() {
    const text = otherText.trim();
    if (!text) return;
    if (q.type === "single") pickSingle(text);
    else if (q.type === "multi") toggleMulti(text);
    setOtherText("");
    setShowOther(false);
  }

  function next() {
    if (!canAdvance) return;
    const trimmedText = otherText.trim();
    if (q.type === "text" && trimmedText) {
      setAnswers((a) => ({ ...a, [q.signal]: trimmedText }));
    }

    if (index < total - 1) {
      setIndex(index + 1);
      setOtherText("");
      setShowOther(false);
      return;
    }

    // Finalize
    const finalAnswers: Record<string, Answer> = {
      ...answers,
      ...(q.type === "text" && trimmedText ? { [q.signal]: trimmedText } : {}),
    };

    const inputs: MessageInputs = {
      coreIntent: (answerForSignal("coreIntent", finalAnswers["coreIntent"]) ??
        "") as string,
      emotions: (answerForSignal("emotions", finalAnswers["emotions"]) ??
        []) as string[],
      values: (answerForSignal("values", finalAnswers["values"]) ??
        []) as string[],
      duality: (answerForSignal("duality", finalAnswers["duality"]) ??
        "") as string,
      themes: (answerForSignal("themes", finalAnswers["themes"]) ??
        []) as string[],
      audienceRelation: (answerForSignal(
        "audienceRelation",
        finalAnswers["audienceRelation"]
      ) ?? "") as string,
      influences: (answerForSignal(
        "influences",
        finalAnswers["influences"]
      ) ?? []) as string[],
      visualWorld: (answerForSignal(
        "visualWorld",
        finalAnswers["visualWorld"]
      ) ?? []) as string[],
      identityTraits: (answerForSignal(
        "identityTraits",
        finalAnswers["identityTraits"]
      ) ?? []) as string[],
      freeExpression:
        typeof finalAnswers["freeExpression"] === "string" &&
        finalAnswers["freeExpression"].length > 0
          ? (finalAnswers["freeExpression"] as string)
          : undefined,
    };

    onComplete(inputs);
  }

  return (
    <div className="w-full">
      {/* Progress dots */}
      <div className="mb-8 flex items-center justify-center gap-1.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`size-1.5 rounded-full transition-colors ${i <= index ? "bg-indigo-400" : "bg-zinc-700"}`}
          />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.signal}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 }}
          transition={{ duration: 0.25 }}
          className="w-full"
        >
          <h2 className="text-center text-xl font-semibold text-white">
            {q.prompt}
          </h2>
          {isMulti(q) && q.maxSelections && (
            <p className="mt-2 text-center text-xs text-zinc-500">
              Pick up to {q.maxSelections}
            </p>
          )}

          {q.type !== "text" && q.options && (
            <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {q.options.map((opt) => {
                const selected =
                  q.type === "single"
                    ? current === opt.label
                    : Array.isArray(current) && current.includes(opt.label);
                return (
                  <button
                    key={opt.id}
                    onClick={() =>
                      q.type === "single"
                        ? pickSingle(opt.label)
                        : toggleMulti(opt.label)
                    }
                    className={`rounded-xl border px-4 py-3 text-left transition-colors ${
                      selected
                        ? "border-indigo-400 bg-indigo-500/10"
                        : "border-zinc-700 hover:border-zinc-500"
                    }`}
                  >
                    <p className="text-sm font-medium text-white">
                      {opt.label}
                    </p>
                    {opt.description && (
                      <p className="mt-1 text-xs text-zinc-400">
                        {opt.description}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          {/* Other / free-text */}
          {q.type === "text" || q.allowOther ? (
            <div className="mt-4">
              {showOther || q.type === "text" ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={otherText}
                    onChange={(e) => setOtherText(e.target.value)}
                    placeholder={
                      q.type === "text"
                        ? "Write a sentence in your own words…"
                        : "Type your own…"
                    }
                    rows={3}
                    className="w-full resize-none rounded-xl border border-zinc-700 bg-zinc-900 p-3 text-sm text-white placeholder:text-zinc-500 focus:border-indigo-400 focus:outline-none"
                  />
                  {q.type !== "text" && (
                    <Button
                      variant="ghost-secondary"
                      size="sm"
                      onClick={commitOther}
                      disabled={!otherText.trim()}
                    >
                      Add
                    </Button>
                  )}
                </div>
              ) : (
                <button
                  onClick={() => setShowOther(true)}
                  className="mx-auto mt-4 flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  <Pencil className="size-3.5" />
                  Other
                </button>
              )}
            </div>
          ) : null}

          <div className="mt-10 flex items-center justify-end">
            <Button onClick={next} disabled={!canAdvance}>
              {isLast ? (isEmptyText ? "Skip" : "Finish") : "Next"}
              <ArrowRight className="size-3.5" />
            </Button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
