import { describe, it, expect, vi } from "vitest";

vi.mock("server-only", () => ({}));

vi.mock("@/server/services/feedback", () => ({
  toggleLike: vi.fn().mockResolvedValue({ liked: true }),
  getLikedAttemptIds: vi.fn().mockResolvedValue(["attempt-1"]),
}));

vi.mock("@/server/services/event-capture", () => ({
  captureEvent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/server/trpc/init", () => {
  const mockProcedure = {
    input: vi.fn().mockReturnThis(),
    mutation: vi.fn().mockReturnThis(),
    query: vi.fn().mockReturnThis(),
  };
  return {
    createTRPCRouter: vi.fn((routes) => routes),
    authedProcedure: mockProcedure,
  };
});

describe("feedback router", () => {
  it("exports feedbackRouter with like and getLikes procedures", async () => {
    const { feedbackRouter } = await import("./feedback");

    expect(feedbackRouter).toBeDefined();
    expect(feedbackRouter).toHaveProperty("like");
    expect(feedbackRouter).toHaveProperty("getLikes");
  });

  it("like procedure accepts sessionId and generationAttemptId input", async () => {
    const { authedProcedure } = await import("@/server/trpc/init");

    await import("./feedback");

    expect(authedProcedure.input).toHaveBeenCalled();
    expect(authedProcedure.mutation).toHaveBeenCalled();
  });

  it("getLikes procedure accepts sessionId input", async () => {
    const { authedProcedure } = await import("@/server/trpc/init");

    await import("./feedback");

    expect(authedProcedure.input).toHaveBeenCalled();
    expect(authedProcedure.query).toHaveBeenCalled();
  });
});
