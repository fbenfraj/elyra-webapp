import { task } from "@trigger.dev/sdk/v3";
import type { TaskPayload, TaskResult } from "@/types/task";
import type { Direction } from "@/lib/schemas/direction";
import { generateDirections } from "@/server/services/direction-generation";

export const generationCreateDirections = task({
  id: "generation-create-directions",
  run: async (
    payload: TaskPayload<{ visualSpecId: string }>
  ): Promise<TaskResult<Direction[]>> => {
    return generateDirections(
      payload.sessionId,
      payload.userId,
      payload.input.visualSpecId
    );
  },
});
