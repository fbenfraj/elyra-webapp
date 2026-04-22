/**
 * Standardized shapes for all Trigger.dev tasks.
 * Every task uses TaskPayload<T> for input and TaskResult<T> for output.
 */

export type TaskPayload<T> = {
  sessionId: string;
  userId: string;
  input: T;
};

export type TaskResult<T> = {
  ok: boolean;
  output?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    costCents: number;
    durationMs: number;
  };
};
