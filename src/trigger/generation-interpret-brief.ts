import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import type { InterpretationOutput } from "@/server/services/interpretation";
import { runInterpretation } from "@/server/services/interpretation";

export const generationInterpretBrief = task({
  id: "generation-interpret-brief",
  run: async (
    payload: TaskPayload<{ briefText: string }>
  ): Promise<TaskResult<InterpretationOutput>> => {
    return runInterpretation(
      payload.sessionId,
      payload.userId,
      payload.input.briefText
    );
  },
});
