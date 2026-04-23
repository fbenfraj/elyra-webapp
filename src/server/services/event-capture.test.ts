import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("server-only", () => ({}));

const insertValuesMock = vi.fn().mockResolvedValue(undefined);
const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

vi.mock("@/server/db", () => ({
  db: {
    insert: (...args: unknown[]) => insertMock(...args),
  },
}));

vi.mock("@/server/db/schema/session-events", () => ({
  sessionEvents: { __table: "session_events" },
}));

import { captureEvent, captureScreenTime } from "./event-capture";

describe("captureEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("inserts a row with correct data", async () => {
    await captureEvent("user-1", "session-1", "direction_selected", {
      directionId: "dir-1",
    });

    expect(insertMock).toHaveBeenCalledOnce();
    expect(insertValuesMock).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "session-1",
      action: "direction_selected",
      payload: { directionId: "dir-1" },
    });
  });

  it("inserts with null payload when none provided", async () => {
    await captureEvent("user-1", "session-1", "recovery_started");

    expect(insertValuesMock).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "session-1",
      action: "recovery_started",
      payload: null,
    });
  });

  it("never throws even when DB insert fails", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    insertValuesMock.mockRejectedValueOnce(new Error("DB connection lost"));

    await expect(
      captureEvent("user-1", "session-1", "screen_entered")
    ).resolves.toBeUndefined();

    expect(consoleSpy).toHaveBeenCalledOnce();
    const loggedMessage = consoleSpy.mock.calls[0]![0] as string;
    const parsed = JSON.parse(loggedMessage);
    expect(parsed.event).toBe("event_capture_failed");
    expect(parsed.action).toBe("screen_entered");

    consoleSpy.mockRestore();
  });
});

describe("captureScreenTime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls captureEvent with screen_exited action and duration", async () => {
    await captureScreenTime("user-1", "session-1", "directions_ready", 5000);

    expect(insertValuesMock).toHaveBeenCalledWith({
      userId: "user-1",
      sessionId: "session-1",
      action: "screen_exited",
      payload: { screen: "directions_ready", durationMs: 5000 },
    });
  });
});
