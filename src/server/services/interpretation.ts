import "server-only";

import type { TaskResult } from "@/types/task";
import type { VisualSpec } from "@/lib/schemas/visual-spec";
import { moderateBrief, interpretBrief } from "@/server/providers/openai";
import { updateSessionStatus, failSession } from "@/server/services/session";
import { executeWithFallback } from "@/server/services/provider-executor";
import { FALLBACK_CHAINS } from "@/config/providers";
import { storeVisualSpec } from "@/server/services/visual-spec-store";

const CONFIDENCE_THRESHOLD = 0.7;

export type InterpretationOutput =
  | { type: "spec"; spec: VisualSpec }
  | { type: "follow_up"; questions: string[] };

export async function runInterpretation(
  sessionId: string,
  userId: string,
  briefText: string
): Promise<TaskResult<InterpretationOutput>> {
  const start = Date.now();

  // Step 1: Content moderation pre-screen (before any billable call)
  const moderation = await moderateBrief(briefText);
  if (moderation.flagged) {
    return {
      ok: false,
      error: {
        code: "CONTENT_POLICY",
        message:
          "We couldn't process this brief. Try describing your vision with different words.",
      },
      meta: {
        costCents: 0,
        durationMs: Date.now() - start,
      },
    };
  }

  // Step 2: Update session status to 'interpreting'
  await updateSessionStatus(sessionId, "interpreting");

  // Step 3: LLM interpretation
  try {
    const result = await executeWithFallback(
      FALLBACK_CHAINS.interpretation,
      async () => interpretBrief(briefText),
      { sessionId }
    );
    const { response } = result;

    // Step 4: Check confidence — return follow-up questions if too vague
    if (
      response.confidence < CONFIDENCE_THRESHOLD ||
      !response.spec
    ) {
      // Reset session back to pending — artist needs to provide more info
      await updateSessionStatus(sessionId, "pending");

      return {
        ok: true,
        output: {
          type: "follow_up",
          questions:
            response.followUpQuestions.length > 0
              ? response.followUpQuestions
              : [
                  "Any artist or album cover that captures the feeling you're after?",
                ],
        },
        meta: {
          costCents: result.costCents,
          durationMs: Date.now() - start,
        },
      };
    }

    // Step 5: Store visual spec
    await storeVisualSpec(sessionId, response.spec);

    // Step 6: Update session status to 'generating_directions'
    await updateSessionStatus(sessionId, "generating_directions");

    return {
      ok: true,
      output: { type: "spec", spec: response.spec },
      meta: {
        costCents: result.costCents,
        durationMs: Date.now() - start,
      },
    };
  } catch (err) {
    console.error("[interpretation] failed:", err);
    // Update session to failed state
    await failSession(sessionId, "interpreting").catch((e) => console.error("[interpretation] failSession error:", e));

    return {
      ok: false,
      error: {
        code: "INTERPRETATION_FAILED",
        message:
          "Something went wrong interpreting your brief. Give it another try.",
      },
      meta: {
        costCents: 0,
        durationMs: Date.now() - start,
      },
    };
  }
}
