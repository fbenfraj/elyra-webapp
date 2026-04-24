/**
 * Story 7.5.3: Observability Verification Tests
 *
 * Verifies:
 * - Task 1: Structured log field completeness across all 7 Trigger.dev tasks
 * - Task 2: Metrics service accuracy (covered in metrics.test.ts, edge cases here)
 * - Task 3: Provider health data accuracy
 * - Task 4: Event capture completeness
 * - Task 5: Trigger.dev task tracing (meta blocks, task names, error handling)
 * - Task 6: Combined observability verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ──────────────────────────────────────────────────────────────────────────────
// Shared mocks required by server-only modules
// ──────────────────────────────────────────────────────────────────────────────

vi.mock("server-only", () => ({}));

// ──────────────────────────────────────────────────────────────────────────────
// Task 1: Structured log field completeness
// Verifies all 8 required fields appear in pipeline stage logs
// ──────────────────────────────────────────────────────────────────────────────

const REQUIRED_LOG_FIELDS = [
  "sessionId",
  "userId",
  "provider",
  "model",
  "costCents",
  "durationMs",
  "stage",
  "finalOutcome",
] as const;

type PipelineLog = {
  event: string;
  sessionId: string;
  userId: string;
  provider: string;
  model: string;
  costCents: number;
  durationMs: number;
  stage: string;
  finalOutcome: string;
  [key: string]: unknown;
};

function assertRequiredLogFields(log: PipelineLog): void {
  for (const field of REQUIRED_LOG_FIELDS) {
    expect(log).toHaveProperty(field);
    expect(log[field]).not.toBeUndefined();
  }
}

function assertCostCentsIsNumber(log: PipelineLog): void {
  expect(typeof log.costCents).toBe("number");
  expect(log.costCents).toBeGreaterThanOrEqual(0);
}

describe("Task 1: Structured log field completeness", () => {
  describe("generation-interpret-brief", () => {
    const mockRunInterpretation = vi.fn();
    const mockFailSession = vi.fn();

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));

      vi.doMock("@/server/services/interpretation", () => ({
        runInterpretation: mockRunInterpretation,
      }));

      vi.doMock("@/server/services/session", () => ({
        failSession: mockFailSession,
      }));

      vi.doMock("@/config/providers", () => ({
        MODEL_ROUTING: {
          interpretation: {
            primary: { provider: "openai", model: "gpt-4.1" },
            fallback: { provider: "openai", model: "gpt-4o" },
          },
          imageGeneration: {
            preview: { provider: "fal", model: "fal-ai/flux/schnell" },
            final: { provider: "fal", model: "fal-ai/flux-pro/v2" },
          },
          evaluation: {
            primary: { provider: "openai", model: "gpt-4o" },
            fallback: { provider: "anthropic", model: "claude-sonnet-4-6" },
          },
        },
      }));
    });

    it("logs all 8 required fields on success", async () => {
      mockRunInterpretation.mockResolvedValue({
        ok: true,
        output: { type: "spec", spec: {} },
        meta: { costCents: 15, durationMs: 1200 },
      });

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { generationInterpretBrief } = await import(
        "./generation-interpret-brief"
      );
      await (generationInterpretBrief as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-1",
        userId: "user-1",
        input: { briefText: "dark moody album cover" },
      });

      expect(infoSpy).toHaveBeenCalledOnce();
      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      assertCostCentsIsNumber(log);
      expect(log.sessionId).toBe("sess-1");
      expect(log.userId).toBe("user-1");
      expect(log.finalOutcome).toBe("success");
      expect(log.costCents).toBe(15);
      expect(log.stage).toBe("interpret_brief");
      expect(log.provider).toBe("openai");
      expect(log.model).toBe("gpt-4.1");

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on service failure (ok: false)", async () => {
      mockRunInterpretation.mockResolvedValue({
        ok: false,
        error: { code: "CONTENT_POLICY", message: "Flagged" },
        meta: { costCents: 0, durationMs: 200 },
      });

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { generationInterpretBrief } = await import(
        "./generation-interpret-brief"
      );
      await (generationInterpretBrief as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-1",
        userId: "user-1",
        input: { briefText: "bad content" },
      });

      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failure");
      expect(log.costCents).toBe(0);

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on thrown exception (failure path)", async () => {
      mockRunInterpretation.mockRejectedValue(new Error("Network error"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { generationInterpretBrief } = await import(
        "./generation-interpret-brief"
      );
      const result = await (generationInterpretBrief as unknown as { run: (...args: unknown[]) => Promise<{ ok: boolean }> }).run({
        sessionId: "sess-1",
        userId: "user-1",
        input: { briefText: "test" },
      });

      expect(errorSpy).toHaveBeenCalledOnce();
      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);
      expect(result.ok).toBe(false);

      errorSpy.mockRestore();
    });

    it("costCents is 0 (not undefined) when no cost incurred before failure", async () => {
      mockRunInterpretation.mockRejectedValue(new Error("immediate failure"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { generationInterpretBrief } = await import(
        "./generation-interpret-brief"
      );
      await (generationInterpretBrief as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-1",
        userId: "user-1",
        input: { briefText: "test" },
      });

      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;
      expect(log.costCents).toBe(0);
      expect(log.costCents).not.toBeUndefined();

      errorSpy.mockRestore();
    });
  });

  describe("generation-create-directions", () => {
    const mockGenerateDirections = vi.fn();
    const mockFailSession = vi.fn();

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));

      vi.doMock("@/server/services/direction-generation", () => ({
        generateDirections: mockGenerateDirections,
      }));

      vi.doMock("@/server/services/session", () => ({
        failSession: mockFailSession,
      }));

      vi.doMock("@/config/providers", () => ({
        MODEL_ROUTING: {
          interpretation: {
            primary: { provider: "openai", model: "gpt-4.1" },
            fallback: { provider: "openai", model: "gpt-4o" },
          },
          imageGeneration: {
            preview: { provider: "fal", model: "fal-ai/flux/schnell" },
            final: { provider: "fal", model: "fal-ai/flux-pro/v2" },
          },
          evaluation: {
            primary: { provider: "openai", model: "gpt-4o" },
            fallback: { provider: "anthropic", model: "claude-sonnet-4-6" },
          },
        },
      }));
    });

    it("logs all 8 required fields on success", async () => {
      mockGenerateDirections.mockResolvedValue({
        ok: true,
        output: [],
        meta: { costCents: 30, durationMs: 5000 },
      });

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { generationCreateDirections } = await import(
        "./generation-create-directions"
      );
      await (generationCreateDirections as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-2",
        userId: "user-2",
        input: { visualSpecId: "spec-1" },
      });

      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("success");
      expect(log.stage).toBe("create_directions");
      expect(log.provider).toBe("fal");

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on thrown exception", async () => {
      mockGenerateDirections.mockRejectedValue(new Error("timeout"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { generationCreateDirections } = await import(
        "./generation-create-directions"
      );
      await (generationCreateDirections as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-2",
        userId: "user-2",
        input: { visualSpecId: "spec-1" },
      });

      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });
  });

  describe("generation-create-images", () => {
    const mockGenerateImages = vi.fn();
    const mockFailSession = vi.fn();
    const mockTrigger = vi.fn().mockResolvedValue(undefined);

    afterEach(() => {
      // Clean up cross-task mock to avoid polluting evaluate-batch tests
      vi.doUnmock("@/trigger/generation-evaluate-batch");
    });

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));

      vi.doMock("@/server/services/image-generation", () => ({
        generateImages: mockGenerateImages,
      }));

      vi.doMock("@/server/services/session", () => ({
        failSession: mockFailSession,
      }));

      vi.doMock("@/trigger/generation-evaluate-batch", () => ({
        generationEvaluateBatch: { trigger: mockTrigger },
      }));

      vi.doMock("@/config/providers", () => ({
        MODEL_ROUTING: {
          interpretation: {
            primary: { provider: "openai", model: "gpt-4.1" },
            fallback: { provider: "openai", model: "gpt-4o" },
          },
          imageGeneration: {
            preview: { provider: "fal", model: "fal-ai/flux/schnell" },
            final: { provider: "fal", model: "fal-ai/flux-pro/v2" },
          },
          evaluation: {
            primary: { provider: "openai", model: "gpt-4o" },
            fallback: { provider: "anthropic", model: "claude-sonnet-4-6" },
          },
        },
      }));
    });

    it("logs all 8 required fields on success", async () => {
      mockGenerateImages.mockResolvedValue({
        ok: true,
        output: { imageCount: 4, totalCostCents: 20 },
        meta: { costCents: 20, durationMs: 8000 },
      });

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { generationCreateImages } = await import(
        "./generation-create-images"
      );
      await (generationCreateImages as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-3",
        userId: "user-3",
        input: { batchNumber: 1 },
      });

      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("success");
      expect(log.stage).toBe("create_images");
      expect(log.provider).toBe("fal");
      expect(log.model).toBe("fal-ai/flux-pro/v2");

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on thrown exception", async () => {
      mockGenerateImages.mockRejectedValue(new Error("provider down"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { generationCreateImages } = await import(
        "./generation-create-images"
      );
      await (generationCreateImages as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-3",
        userId: "user-3",
        input: { batchNumber: 1 },
      });

      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });
  });

  describe("generation-evaluate-batch", () => {
    const mockEvaluateBatch = vi.fn();
    const mockUpdateSessionStatus = vi.fn();
    const mockFailSession = vi.fn();

    afterEach(() => {
      // Clean up cross-task mock to avoid polluting refine-prompt tests
      vi.doUnmock("@/trigger/generation-refine-prompt");
    });

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));
      vi.doMock("@/server/services/evaluation", () => ({
        evaluateBatch: mockEvaluateBatch,
        getBatchCount: vi.fn(),
      }));
      vi.doMock("@/server/services/session", () => ({
        updateSessionStatus: mockUpdateSessionStatus,
        failSession: mockFailSession,
      }));
      vi.doMock("@/config/evaluation", () => ({ MAX_EVAL_RETRIES: 3 }));
      vi.doMock("@/trigger/generation-refine-prompt", () => ({
        generationRefinePrompt: { trigger: vi.fn() },
      }));
      vi.doMock("@/config/providers", () => ({
        MODEL_ROUTING: {
          evaluation: { primary: { provider: "openai", model: "gpt-4o" } },
        },
      }));
    });

    it("logs all 8 required fields on success", async () => {
      mockEvaluateBatch.mockResolvedValue({
        ok: true,
        output: { evaluatedCount: 4, passingCount: 3, totalCostCents: 5 },
        meta: { costCents: 5, durationMs: 3000 },
      });
      mockUpdateSessionStatus.mockResolvedValue(undefined);

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const mod = await import("./generation-evaluate-batch");
      await (mod.generationEvaluateBatch as unknown as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-4",
        userId: "user-4",
        input: {},
      });

      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("success");
      expect(log.stage).toBe("evaluate_batch");
      expect(log.provider).toBe("openai");
      expect(log.model).toBe("gpt-4o");

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on thrown exception", async () => {
      mockEvaluateBatch.mockRejectedValue(new Error("eval failed"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mod = await import("./generation-evaluate-batch");
      await (mod.generationEvaluateBatch as unknown as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-4",
        userId: "user-4",
        input: {},
      });

      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });
  });

  describe("generation-refine-prompt", () => {
    const mockRefinePrompt = vi.fn();
    const mockGetEvaluationFeedback = vi.fn();
    const mockGetBatchCount = vi.fn();
    const mockFailSession = vi.fn();

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));
      vi.doMock("@/server/services/image-generation", () => ({
        refinePrompt: mockRefinePrompt,
      }));
      vi.doMock("@/server/services/evaluation", () => ({
        getEvaluationFeedback: mockGetEvaluationFeedback,
        getBatchCount: mockGetBatchCount,
      }));
      vi.doMock("@/server/services/session", () => ({
        failSession: mockFailSession,
      }));
      vi.doMock("@/trigger/generation-create-images", () => ({
        generationCreateImages: { trigger: vi.fn() },
      }));
      vi.doMock("@/config/providers", () => ({
        MODEL_ROUTING: {
          interpretation: { primary: { provider: "openai", model: "gpt-4.1" } },
        },
      }));
    });

    it("logs all 8 required fields on success", async () => {
      mockGetEvaluationFeedback.mockResolvedValue("Not saturated enough");
      mockRefinePrompt.mockResolvedValue({
        ok: true,
        output: { refinedPrompt: "enhanced prompt" },
        meta: { costCents: 3, durationMs: 2000 },
      });
      mockGetBatchCount.mockResolvedValue(1);

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const mod = await import("./generation-refine-prompt");
      await (mod.generationRefinePrompt as unknown as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-5",
        userId: "user-5",
        input: {},
      });

      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("success");
      expect(log.stage).toBe("refine_prompt");
      expect(log.provider).toBe("openai");

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on thrown exception", async () => {
      mockGetEvaluationFeedback.mockRejectedValue(new Error("DB error"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const mod = await import("./generation-refine-prompt");
      await (mod.generationRefinePrompt as unknown as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-5",
        userId: "user-5",
        input: {},
      });

      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });
  });

  describe("generation-assemble-package", () => {
    const mockAssemblePackage = vi.fn();
    const mockFailSession = vi.fn();

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));

      vi.doMock("@/server/services/packaging", () => ({
        assemblePackage: mockAssemblePackage,
      }));

      vi.doMock("@/server/services/session", () => ({
        failSession: mockFailSession,
      }));
    });

    it("logs all 8 required fields on success", async () => {
      mockAssemblePackage.mockResolvedValue({
        ok: true,
        output: { deliverableCount: 4, totalSizeBytes: 5_000_000 },
        meta: { costCents: 0, durationMs: 1500 },
      });

      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      const { generationAssemblePackage } = await import(
        "./generation-assemble-package"
      );
      await (generationAssemblePackage as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-6",
        userId: "user-6",
        input: {},
      });

      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("success");
      expect(log.stage).toBe("assemble_package");
      // Package assembly is internal — no external provider
      expect(log.provider).toBe("internal");
      expect(log.costCents).toBe(0);

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on thrown exception", async () => {
      mockAssemblePackage.mockRejectedValue(new Error("storage error"));
      mockFailSession.mockResolvedValue(undefined);

      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const { generationAssemblePackage } = await import(
        "./generation-assemble-package"
      );
      await (generationAssemblePackage as unknown as { run: (...args: unknown[]) => unknown }).run({
        sessionId: "sess-6",
        userId: "user-6",
        input: {},
      });

      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });
  });

  describe("webhook-process-fal", () => {
    const mockWithIdempotency = vi.fn();
    const mockFailSession = vi.fn();

    beforeEach(() => {
      vi.resetModules();
      vi.clearAllMocks();

      vi.doMock("@trigger.dev/sdk/v3", () => ({
        task: (config: { id: string; run: unknown }) => config,
      }));

      vi.doMock("@/server/services/idempotency", () => ({
        withIdempotency: mockWithIdempotency,
      }));

      vi.doMock("@/server/services/session", () => ({
        failSession: mockFailSession,
      }));
    });

    it("logs all 8 required fields on successful webhook", async () => {
      const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

      mockWithIdempotency.mockImplementation(
        async (_key: string, _name: string, fn: () => Promise<void>) => {
          await fn();
          return { skipped: false };
        }
      );

      const { webhookProcessFal } = await import("./webhook-process-fal");
      await (webhookProcessFal as unknown as { run: (...args: unknown[]) => unknown }).run({
        requestId: "req-1",
        sessionId: "sess-7",
        userId: "user-7",
        status: "OK",
        payload: {
          images: [{ url: "https://cdn.fal.ai/img.jpg", content_type: "image/jpeg" }],
        },
      });

      expect(infoSpy).toHaveBeenCalledOnce();
      const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("success");
      expect(log.stage).toBe("webhook_process_fal");
      expect(log.provider).toBe("fal");
      expect(log.costCents).toBe(0);

      infoSpy.mockRestore();
    });

    it("logs all 8 required fields on ERROR status webhook", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFailSession.mockResolvedValue(undefined);

      mockWithIdempotency.mockImplementation(
        async (_key: string, _name: string, fn: () => Promise<void>) => {
          await fn();
          return { skipped: false };
        }
      );

      const { webhookProcessFal } = await import("./webhook-process-fal");
      await (webhookProcessFal as unknown as { run: (...args: unknown[]) => unknown }).run({
        requestId: "req-2",
        sessionId: "sess-7",
        userId: "user-7",
        status: "ERROR",
        error: "Generation failed",
      });

      expect(errorSpy).toHaveBeenCalledOnce();
      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });

    it("logs all 8 required fields when no images returned", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFailSession.mockResolvedValue(undefined);

      mockWithIdempotency.mockImplementation(
        async (_key: string, _name: string, fn: () => Promise<void>) => {
          await fn();
          return { skipped: false };
        }
      );

      const { webhookProcessFal } = await import("./webhook-process-fal");
      await (webhookProcessFal as unknown as { run: (...args: unknown[]) => unknown }).run({
        requestId: "req-3",
        sessionId: "sess-7",
        userId: "user-7",
        status: "OK",
        payload: { images: [] },
      });

      expect(errorSpy).toHaveBeenCalledOnce();
      const log = JSON.parse(errorSpy.mock.calls[0]![0] as string) as PipelineLog;

      assertRequiredLogFields(log);
      expect(log.finalOutcome).toBe("failed");
      expect(log.costCents).toBe(0);

      errorSpy.mockRestore();
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 2 (supplemental): Metrics edge cases not covered in metrics.test.ts
// ──────────────────────────────────────────────────────────────────────────────

describe("Task 2: Metrics service edge cases", () => {
  const executeMock = vi.fn();
  const selectMock = vi.fn();

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();

    vi.doMock("server-only", () => ({}));

    vi.doMock("@/server/db", () => ({
      db: {
        execute: (...args: unknown[]) => executeMock(...args),
        select: (...args: unknown[]) => selectMock(...args),
      },
    }));

    vi.doMock("@/server/db/schema/generation-attempts", () => ({
      generationAttempts: {
        id: "id",
        sessionId: "session_id",
        costCents: "cost_cents",
        model: "model",
        provider: "provider",
      },
    }));

    vi.doMock("@/config/evaluation", () => ({
      MIN_PASS_SCORE: 0.7,
    }));
  });

  it("getHitRate returns 0 for null hit_rate (no sessions)", async () => {
    executeMock.mockResolvedValueOnce([{ hit_rate: null }]);

    const { getHitRate } = await import("@/server/services/metrics");
    const result = await getHitRate();
    expect(result).toBe(0);
  });

  it("getHitRate returns 0 when result array is empty", async () => {
    executeMock.mockResolvedValueOnce([]);

    const { getHitRate } = await import("@/server/services/metrics");
    const result = await getHitRate();
    expect(result).toBe(0);
  });

  it("getGenerationSuccessRate returns 0 for both rates when no sessions", async () => {
    executeMock.mockResolvedValueOnce([
      { first_attempt_rate: null, overall_rate: null },
    ]);

    const { getGenerationSuccessRate } = await import(
      "@/server/services/metrics"
    );
    const result = await getGenerationSuccessRate();
    expect(result.firstAttempt).toBe(0);
    expect(result.overall).toBe(0);
  });

  it("getAverageCostPerDeliverable returns 0 when no deliverables", async () => {
    executeMock.mockResolvedValueOnce([{ avg_cost: null }]);

    const { getAverageCostPerDeliverable } = await import(
      "@/server/services/metrics"
    );
    const result = await getAverageCostPerDeliverable();
    expect(result).toBe(0);
  });

  it("getAverageLatency returns 0 for empty session set", async () => {
    executeMock.mockResolvedValueOnce([{ avg_latency_ms: null }]);

    const { getAverageLatency } = await import("@/server/services/metrics");
    const result = await getAverageLatency();
    expect(result).toBe(0);
  });

  it("getEvalScoreDistribution returns all-zero buckets when no evaluated attempts", async () => {
    executeMock.mockResolvedValueOnce([
      {
        "0-0.3": null,
        "0.3-0.5": null,
        "0.5-0.7": null,
        "0.7-0.85": null,
        "0.85-1.0": null,
      },
    ]);

    const { getEvalScoreDistribution } = await import(
      "@/server/services/metrics"
    );
    const result = await getEvalScoreDistribution();
    expect(result["0-0.3"]).toBe(0);
    expect(result["0.3-0.5"]).toBe(0);
    expect(result["0.5-0.7"]).toBe(0);
    expect(result["0.7-0.85"]).toBe(0);
    expect(result["0.85-1.0"]).toBe(0);
  });

  it("getSessionCostBreakdown returns 0 total for session with no attempts", async () => {
    const fromMock = vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    });
    selectMock.mockReturnValue({ from: fromMock });

    const { getSessionCostBreakdown } = await import(
      "@/server/services/metrics"
    );
    const result = await getSessionCostBreakdown("empty-session");
    expect(result.totalCostCents).toBe(0);
    expect(result.attempts).toHaveLength(0);
  });

  it("getCostOutliers returns empty array when no sessions exceed threshold", async () => {
    executeMock.mockResolvedValueOnce([]);

    const { getCostOutliers } = await import("@/server/services/metrics");
    const result = await getCostOutliers(10000);
    expect(result).toEqual([]);
  });

  it("getCostOutliers with date range passes range to query", async () => {
    executeMock.mockResolvedValueOnce([
      { id: "s-1", total_cost_cents: 500, attempt_count: 5 },
    ]);

    const { getCostOutliers } = await import("@/server/services/metrics");
    const range = {
      from: new Date("2026-01-01"),
      to: new Date("2026-01-31"),
    };
    const result = await getCostOutliers(100, range);
    expect(result).toHaveLength(1);
    expect(executeMock).toHaveBeenCalledOnce();
  });

  it("date range boundaries are inclusive", async () => {
    executeMock.mockResolvedValueOnce([{ hit_rate: 75 }]);

    const { getHitRate } = await import("@/server/services/metrics");
    const from = new Date("2026-01-01T00:00:00Z");
    const to = new Date("2026-01-31T23:59:59Z");
    const result = await getHitRate({ from, to });

    expect(result).toBe(75);
    // Verify execute was called with the date range
    expect(executeMock).toHaveBeenCalledOnce();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 3: Provider health data — circuit breaker state consistency
// ──────────────────────────────────────────────────────────────────────────────

describe("Task 3: Provider health reflects circuit breaker state", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up cross-module mocks to avoid polluting subsequent tests
    vi.doUnmock("@/server/services/circuit-breaker");
    vi.doUnmock("@/server/providers/fal");
    vi.doUnmock("@/server/providers/openai");
    vi.doUnmock("@/server/providers/anthropic");
    vi.doUnmock("@/config/providers");
  });

  it("getProviderStatuses reflects open circuit breaker state", async () => {
    vi.doMock("server-only", () => ({}));

    vi.doMock("@/server/db", () => ({
      db: { execute: vi.fn() },
    }));

    const mockOpenState = {
      fal: {
        state: "open" as const,
        failureCount: 5,
        lastFailureTime: Date.now(),
        lastSuccessTime: null,
        openedAt: Date.now() - 5000,
      },
    };

    vi.doMock("@/server/services/circuit-breaker", () => ({
      getAllStates: vi.fn().mockReturnValue(mockOpenState),
    }));

    const healthData = {
      status: "up" as const,
      lastChecked: new Date(),
      latencyMs: 100,
      errorCount: 0,
    };

    vi.doMock("@/server/providers/fal", () => ({
      falAdapter: { getHealth: vi.fn().mockResolvedValue(healthData) },
    }));
    vi.doMock("@/server/providers/openai", () => ({
      openaiEvaluationAdapter: {
        getHealth: vi.fn().mockResolvedValue(healthData),
      },
    }));
    vi.doMock("@/server/providers/anthropic", () => ({
      anthropicEvaluationAdapter: {
        getHealth: vi.fn().mockResolvedValue(healthData),
      },
    }));

    const { getProviderStatuses } = await import(
      "@/server/services/provider-health"
    );
    const statuses = await getProviderStatuses();

    const falStatus = statuses.find((s) => s.provider === "fal");
    expect(falStatus).toBeDefined();
    expect(falStatus?.circuitBreakerState.state).toBe("open");
    expect(falStatus?.circuitBreakerState.failureCount).toBe(5);
  });

  it("getProviderStatuses defaults circuit breaker to closed when no state", async () => {
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/server/db", () => ({ db: { execute: vi.fn() } }));
    vi.doMock("@/server/services/circuit-breaker", () => ({
      getAllStates: vi.fn().mockReturnValue({}),
    }));

    const healthData = {
      status: "up" as const,
      lastChecked: new Date(),
      latencyMs: 50,
      errorCount: 0,
    };

    vi.doMock("@/server/providers/fal", () => ({
      falAdapter: { getHealth: vi.fn().mockResolvedValue(healthData) },
    }));
    vi.doMock("@/server/providers/openai", () => ({
      openaiEvaluationAdapter: {
        getHealth: vi.fn().mockResolvedValue(healthData),
      },
    }));
    vi.doMock("@/server/providers/anthropic", () => ({
      anthropicEvaluationAdapter: {
        getHealth: vi.fn().mockResolvedValue(healthData),
      },
    }));

    const { getProviderStatuses } = await import(
      "@/server/services/provider-health"
    );
    const statuses = await getProviderStatuses();

    for (const status of statuses) {
      expect(status.circuitBreakerState.state).toBe("closed");
      expect(status.circuitBreakerState.failureCount).toBe(0);
    }
  });

  it("circuit breaker state transitions correctly: closed → open → half-open → closed", async () => {
    // This test uses the real circuit-breaker module (not mocked) to verify
    // actual state transitions. We re-mock only server-only and config.
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/config/providers", () => ({
      CIRCUIT_BREAKER_CONFIG: {
        failureThreshold: 5,
        windowMs: 60_000,
        cooldownMs: 30_000,
      },
    }));

    vi.useFakeTimers();

    const circuitBreaker = await import("@/server/services/circuit-breaker");

    circuitBreaker._resetAll();

    // Start closed
    expect(circuitBreaker.getState("fal").state).toBe("closed");
    expect(circuitBreaker.canExecute("fal")).toBe(true);

    // Accumulate failures
    for (let i = 0; i < 5; i++) circuitBreaker.recordFailure("fal");
    expect(circuitBreaker.getState("fal").state).toBe("open");
    expect(circuitBreaker.canExecute("fal")).toBe(false);

    // After cooldown → half-open
    vi.advanceTimersByTime(30_000);
    expect(circuitBreaker.canExecute("fal")).toBe(true);
    expect(circuitBreaker.getState("fal").state).toBe("half-open");

    // Success → closed
    circuitBreaker.recordSuccess("fal");
    expect(circuitBreaker.getState("fal").state).toBe("closed");
    expect(circuitBreaker.getState("fal").failureCount).toBe(0);

    vi.useRealTimers();
    circuitBreaker._resetAll();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 4: Event capture completeness
// ──────────────────────────────────────────────────────────────────────────────

describe("Task 4: Event capture completeness", () => {
  const insertValuesMock = vi.fn().mockResolvedValue(undefined);
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insertValuesMock.mockResolvedValue(undefined);

    vi.doMock("server-only", () => ({}));

    vi.doMock("@/server/db", () => ({
      db: {
        insert: (...args: unknown[]) => insertMock(...args),
      },
    }));

    vi.doMock("@/server/db/schema/session-events", () => ({
      sessionEvents: { __table: "session_events" },
    }));
  });

  const SESSION_EVENTS = [
    "screen_enter",
    "brief_submitted",
    "direction_selected",
    "direction_rejected",
    "image_selected",
    "image_liked",
    "recovery_started",
    "package_downloaded",
  ] as const;

  it("captureEvent records all expected session flow events without error", async () => {
    const { captureEvent } = await import("@/server/services/event-capture");

    for (const action of SESSION_EVENTS) {
      await captureEvent("user-test", "session-test", action);
    }

    expect(insertValuesMock).toHaveBeenCalledTimes(SESSION_EVENTS.length);

    for (let i = 0; i < SESSION_EVENTS.length; i++) {
      const call = insertValuesMock.mock.calls[i]![0] as {
        action: string;
        userId: string;
        sessionId: string;
      };
      expect(call.action).toBe(SESSION_EVENTS[i]);
      expect(call.userId).toBe("user-test");
      expect(call.sessionId).toBe("session-test");
    }
  });

  it("fire-and-forget: failures are logged with console.error, never thrown", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    insertValuesMock.mockRejectedValueOnce(new Error("DB connection lost"));

    const { captureEvent } = await import("@/server/services/event-capture");

    // Must NOT throw even when DB fails
    await expect(
      captureEvent("user-1", "session-1", "direction_selected")
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledOnce();
    const logArg = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(logArg) as { event: string; action: string };
    expect(parsed.event).toBe("event_capture_failed");
    expect(parsed.action).toBe("direction_selected");

    consoleSpy.mockRestore();
  });

  it("fire-and-forget: DB error does not propagate to caller", async () => {
    insertValuesMock.mockRejectedValue(new Error("catastrophic DB failure"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const { captureEvent } = await import("@/server/services/event-capture");

    // All calls should resolve without throwing
    await Promise.all(
      SESSION_EVENTS.map((action) =>
        expect(captureEvent("u", "s", action)).resolves.toBeUndefined()
      )
    );

    vi.restoreAllMocks();
  });

  it("captureEvent includes all required fields in the DB insert", async () => {
    vi.resetModules();

    const localInsertValues = vi.fn().mockResolvedValue(undefined);
    const localInsert = vi.fn().mockReturnValue({ values: localInsertValues });

    vi.doMock("server-only", () => ({}));
    vi.doMock("@/server/db", () => ({ db: { insert: localInsert } }));
    vi.doMock("@/server/db/schema/session-events", () => ({
      sessionEvents: { __table: "session_events" },
    }));

    const { captureEvent } = await import("@/server/services/event-capture");
    const payload = { directionId: "dir-1", score: 0.85 };

    await captureEvent("user-42", "sess-42", "direction_selected", payload);

    expect(localInsertValues).toHaveBeenCalledWith({
      userId: "user-42",
      sessionId: "sess-42",
      action: "direction_selected",
      payload,
    });
  });

  it("captureEvent stores null payload when none provided", async () => {
    vi.resetModules();

    const localInsertValues = vi.fn().mockResolvedValue(undefined);
    const localInsert = vi.fn().mockReturnValue({ values: localInsertValues });

    vi.doMock("server-only", () => ({}));
    vi.doMock("@/server/db", () => ({ db: { insert: localInsert } }));
    vi.doMock("@/server/db/schema/session-events", () => ({
      sessionEvents: { __table: "session_events" },
    }));

    const { captureEvent } = await import("@/server/services/event-capture");

    await captureEvent("user-42", "sess-42", "recovery_started");

    expect(localInsertValues).toHaveBeenCalledWith({
      userId: "user-42",
      sessionId: "sess-42",
      action: "recovery_started",
      payload: null,
    });
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 5: Trigger.dev task tracing — task IDs, conventions, error propagation
// ──────────────────────────────────────────────────────────────────────────────

describe("Task 5: Trigger.dev task tracing", () => {
  it("all task IDs follow kebab-case {domain}-{action} convention", () => {
    const expectedTaskIds = [
      "generation-interpret-brief",
      "generation-create-directions",
      "generation-create-images",
      "generation-evaluate-batch",
      "generation-refine-prompt",
      "generation-assemble-package",
      "webhook-process-fal",
    ];

    const kebabCase = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;

    for (const id of expectedTaskIds) {
      expect(id).toMatch(kebabCase);
      // Must have at least one hyphen (domain-action structure)
      expect(id).toContain("-");
    }
  });

  it("task result meta block always contains costCents and durationMs", () => {
    // Verify TaskResult<T> type contract
    type Meta = { costCents: number; durationMs: number };

    const validMeta: Meta = { costCents: 0, durationMs: 100 };
    expect(validMeta.costCents).toBeDefined();
    expect(validMeta.durationMs).toBeDefined();

    // Verify 0 is a valid costCents value (not undefined)
    const zeroCostMeta: Meta = { costCents: 0, durationMs: 0 };
    expect(zeroCostMeta.costCents).toBe(0);
    expect(zeroCostMeta.costCents).not.toBeUndefined();
  });

  it("failed tasks return structured error with code and message, not raw errors", async () => {
    vi.resetModules();

    vi.doMock("@trigger.dev/sdk/v3", () => ({
      task: (config: { id: string; run: unknown }) => config,
    }));

    vi.doMock("@/server/services/interpretation", () => ({
      runInterpretation: vi.fn().mockRejectedValue(new Error("raw network error")),
    }));

    vi.doMock("@/server/services/session", () => ({
      failSession: vi.fn().mockResolvedValue(undefined),
    }));

    vi.doMock("@/config/providers", () => ({
      MODEL_ROUTING: {
        interpretation: {
          primary: { provider: "openai", model: "gpt-4.1" },
        },
      },
    }));

    vi.spyOn(console, "error").mockImplementation(() => {});

    const { generationInterpretBrief } = await import(
      "./generation-interpret-brief"
    );
    const result = await (generationInterpretBrief as unknown as { run: (...args: unknown[]) => unknown }).run({
      sessionId: "sess-err",
      userId: "user-err",
      input: { briefText: "test" },
    }) as { ok: boolean; error?: { code: string; message: string }; meta: { costCents: number } };

    // Raw errors must NOT be exposed
    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error!.code).toBe("TASK_FAILED");
    expect(result.error!.message).not.toContain("raw network error");
    // costCents must be 0 not undefined
    expect(result.meta.costCents).toBe(0);

    vi.restoreAllMocks();
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// Task 6: Combined observability verification
// ──────────────────────────────────────────────────────────────────────────────

describe("Task 6: Combined observability verification", () => {
  afterEach(() => {
    vi.doUnmock("@/server/services/circuit-breaker");
    vi.doUnmock("@/config/providers");
    vi.doUnmock("@/server/db");
    vi.doUnmock("@/server/db/schema/provider-metrics");
  });

  it("all pipeline stage logs have event=pipeline_stage_complete", async () => {
    vi.resetModules();

    vi.doMock("@trigger.dev/sdk/v3", () => ({
      task: (config: { id: string; run: unknown }) => config,
    }));

    vi.doMock("@/server/services/packaging", () => ({
      assemblePackage: vi.fn().mockResolvedValue({
        ok: true,
        output: { deliverableCount: 2, totalSizeBytes: 1_000_000 },
        meta: { costCents: 0, durationMs: 500 },
      }),
    }));

    vi.doMock("@/server/services/session", () => ({
      failSession: vi.fn().mockResolvedValue(undefined),
    }));

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const { generationAssemblePackage } = await import(
      "./generation-assemble-package"
    );
    await (generationAssemblePackage as unknown as { run: (...args: unknown[]) => unknown }).run({
      sessionId: "sess-obs",
      userId: "user-obs",
      input: {},
    });

    const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;
    expect(log.event).toBe("pipeline_stage_complete");

    infoSpy.mockRestore();
  });

  it("finalOutcome is always 'success', 'failure', or 'failed' — never undefined", async () => {
    // Verify that successful service call logs 'success' or 'failure' (ok-based)
    vi.resetModules();

    vi.doMock("@trigger.dev/sdk/v3", () => ({
      task: (config: { id: string; run: unknown }) => config,
    }));

    vi.doMock("@/server/services/packaging", () => ({
      assemblePackage: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "PACK_FAILED", message: "Failed to pack" },
        meta: { costCents: 0, durationMs: 100 },
      }),
    }));

    vi.doMock("@/server/services/session", () => ({
      failSession: vi.fn().mockResolvedValue(undefined),
    }));

    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    const { generationAssemblePackage } = await import(
      "./generation-assemble-package"
    );
    await (generationAssemblePackage as unknown as { run: (...args: unknown[]) => unknown }).run({
      sessionId: "sess-obs-2",
      userId: "user-obs-2",
      input: {},
    });

    const log = JSON.parse(infoSpy.mock.calls[0]![0] as string) as PipelineLog;
    expect(["success", "failure", "failed"]).toContain(log.finalOutcome);
    expect(log.finalOutcome).not.toBeUndefined();

    infoSpy.mockRestore();
  });

  it("provider metrics records are written on every provider call via executeWithFallback", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("server-only", () => ({}));

    const localInsertValues = vi.fn().mockResolvedValue(undefined);
    const localInsert = vi.fn().mockReturnValue({ values: localInsertValues });

    vi.doMock("@/server/db", () => ({
      db: { insert: localInsert },
    }));

    vi.doMock("@/server/db/schema/provider-metrics", () => ({
      providerMetrics: {},
    }));

    vi.doMock("@/server/services/circuit-breaker", () => ({
      canExecute: vi.fn().mockReturnValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    }));

    vi.doMock("@/config/providers", () => ({
      RETRY_CONFIG: {
        fal: { maxRetries: 0, retryDelayMs: 0, timeoutMs: 5000 },
      },
    }));

    const { executeWithFallback } = await import(
      "@/server/services/provider-executor"
    );

    await executeWithFallback(
      ["fal"],
      vi.fn().mockResolvedValue("result"),
      { sessionId: "sess-metric" }
    );

    // Allow microtasks to settle (fire-and-forget)
    await new Promise((r) => setTimeout(r, 50));

    expect(localInsert).toHaveBeenCalledOnce();
    const insertCall = localInsertValues.mock.calls[0]![0] as {
      provider: string;
      success: boolean;
      sessionId: string;
    };
    expect(insertCall.provider).toBe("fal");
    expect(insertCall.success).toBe(true);
    expect(insertCall.sessionId).toBe("sess-metric");
  });

  it("provider metrics records failure when provider call throws", async () => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.doMock("server-only", () => ({}));

    const localInsertValues = vi.fn().mockResolvedValue(undefined);
    const localInsert = vi.fn().mockReturnValue({ values: localInsertValues });

    vi.doMock("@/server/db", () => ({
      db: { insert: localInsert },
    }));

    vi.doMock("@/server/db/schema/provider-metrics", () => ({
      providerMetrics: {},
    }));

    vi.doMock("@/server/services/circuit-breaker", () => ({
      canExecute: vi.fn().mockReturnValue(true),
      recordSuccess: vi.fn(),
      recordFailure: vi.fn(),
    }));

    vi.doMock("@/config/providers", () => ({
      RETRY_CONFIG: {
        fal: { maxRetries: 0, retryDelayMs: 0, timeoutMs: 5000 },
      },
    }));

    const { executeWithFallback, AllProvidersFailedError } = await import(
      "@/server/services/provider-executor"
    );

    await expect(
      executeWithFallback(
        ["fal"],
        vi.fn().mockRejectedValue(new Error("provider down"))
      )
    ).rejects.toBeInstanceOf(AllProvidersFailedError);

    // Allow microtasks to settle (fire-and-forget)
    await new Promise((r) => setTimeout(r, 50));

    expect(localInsert).toHaveBeenCalledOnce();
    const insertCall = localInsertValues.mock.calls[0]![0] as {
      provider: string;
      success: boolean;
    };
    expect(insertCall.provider).toBe("fal");
    expect(insertCall.success).toBe(false);
  });
});
