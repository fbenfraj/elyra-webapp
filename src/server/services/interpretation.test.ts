import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const mockModerateBrief = vi.fn();
const mockInterpretBrief = vi.fn();

vi.mock("@/server/providers/openai", () => ({
  moderateBrief: (...args: unknown[]) => mockModerateBrief(...args),
  interpretBrief: (...args: unknown[]) => mockInterpretBrief(...args),
}));

const mockUpdateSessionStatus = vi.fn();
const mockStoreVisualSpec = vi.fn();

vi.mock("@/server/services/session", () => ({
  createSession: vi.fn(),
  listByUserId: vi.fn(),
  updateSessionStatus: (...args: unknown[]) =>
    mockUpdateSessionStatus(...args),
}));

vi.mock("@/server/services/visual-spec-store", () => ({
  storeVisualSpec: (...args: unknown[]) => mockStoreVisualSpec(...args),
}));

const validSpec = {
  palette: ["#1a1a2e", "#16213e", "#0f3460", "#e94560"],
  mood: "dark cinematic isolation",
  composition: "centered subject, low-angle perspective",
  style: "photographic realism with muted grading",
  culturalReferences: ["Blade Runner 2049"],
  genreContext: "dark trap",
};

describe("interpretation service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns visual spec when moderation passes and LLM is confident", async () => {
    mockModerateBrief.mockResolvedValue({ flagged: false, categories: [] });
    mockInterpretBrief.mockResolvedValue({
      response: { confidence: 0.9, followUpQuestions: [], spec: validSpec },
      costCents: 0.5,
      durationMs: 1200,
    });
    mockUpdateSessionStatus.mockResolvedValue(undefined);
    mockStoreVisualSpec.mockResolvedValue({ id: "vs-123" });

    const { runInterpretation } = await import("./interpretation");
    const result = await runInterpretation(
      "session-1",
      "user-1",
      "dark cinematic trap"
    );

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({ type: "spec", spec: validSpec });
    expect(result.meta.costCents).toBe(0.5);
    expect(mockUpdateSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "interpreting"
    );
    expect(mockStoreVisualSpec).toHaveBeenCalledWith("session-1", validSpec);
  });

  it("returns follow-up questions when LLM confidence is below threshold", async () => {
    mockModerateBrief.mockResolvedValue({ flagged: false, categories: [] });
    mockInterpretBrief.mockResolvedValue({
      response: {
        confidence: 0.4,
        followUpQuestions: [
          "More gritty or more polished?",
          "Any artist or album cover that captures this feeling?",
        ],
        spec: undefined,
      },
      costCents: 0.3,
      durationMs: 800,
    });
    mockUpdateSessionStatus.mockResolvedValue(undefined);

    const { runInterpretation } = await import("./interpretation");
    const result = await runInterpretation(
      "session-1",
      "user-1",
      "make it cool"
    );

    expect(result.ok).toBe(true);
    expect(result.output).toEqual({
      type: "follow_up",
      questions: [
        "More gritty or more polished?",
        "Any artist or album cover that captures this feeling?",
      ],
    });
    // Session should be reset to pending for follow-up
    expect(mockUpdateSessionStatus).toHaveBeenCalledWith(
      "session-1",
      "pending"
    );
    expect(mockStoreVisualSpec).not.toHaveBeenCalled();
  });

  it("returns error when content moderation flags the brief", async () => {
    mockModerateBrief.mockResolvedValue({
      flagged: true,
      categories: ["violence"],
    });

    const { runInterpretation } = await import("./interpretation");
    const result = await runInterpretation(
      "session-1",
      "user-1",
      "violent content"
    );

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("CONTENT_POLICY");
    expect(mockInterpretBrief).not.toHaveBeenCalled();
  });

  it("updates session status to interpreting before LLM call", async () => {
    mockModerateBrief.mockResolvedValue({ flagged: false, categories: [] });
    mockInterpretBrief.mockResolvedValue({
      response: { confidence: 0.85, followUpQuestions: [], spec: validSpec },
      costCents: 0.3,
      durationMs: 900,
    });
    mockUpdateSessionStatus.mockResolvedValue(undefined);
    mockStoreVisualSpec.mockResolvedValue({ id: "vs-456" });

    const { runInterpretation } = await import("./interpretation");
    await runInterpretation("session-1", "user-1", "moody ambient");

    // First call should be 'interpreting', second should be 'generating_directions'
    expect(mockUpdateSessionStatus).toHaveBeenNthCalledWith(
      1,
      "session-1",
      "interpreting"
    );
    expect(mockUpdateSessionStatus).toHaveBeenNthCalledWith(
      2,
      "session-1",
      "generating_directions"
    );
  });

  it("returns error when LLM call fails", async () => {
    mockModerateBrief.mockResolvedValue({ flagged: false, categories: [] });
    mockInterpretBrief.mockRejectedValue(new Error("API timeout"));
    mockUpdateSessionStatus.mockResolvedValue(undefined);

    const { runInterpretation } = await import("./interpretation");
    const result = await runInterpretation("session-1", "user-1", "brief text");

    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe("INTERPRETATION_FAILED");
  });
});
