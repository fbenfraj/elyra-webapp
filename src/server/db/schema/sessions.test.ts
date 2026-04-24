import { describe, it, expect, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";

vi.mock("server-only", () => ({}));

import { sessions } from "./sessions";

describe("sessions schema", () => {
  it("has the correct table name", () => {
    expect(getTableName(sessions)).toBe("sessions");
  });

  it("has the expected columns", () => {
    const columns = getTableColumns(sessions);
    expect(Object.keys(columns)).toEqual([
      "id",
      "userId",
      "briefText",
      "status",
      "failedStage",
      "selectedDirectionId",
      "selectedGenerationJobId",
      "refinementCount",
      "refinementHistory",
      "regenCount",
      "maxRegens",
      "shareId",
      "createdAt",
      "updatedAt",
    ]);
  });

  it("has userId as non-nullable", () => {
    const columns = getTableColumns(sessions);
    expect(columns.userId.notNull).toBe(true);
  });

  it("has briefText as non-nullable", () => {
    const columns = getTableColumns(sessions);
    expect(columns.briefText.notNull).toBe(true);
  });

  it("has status as non-nullable", () => {
    const columns = getTableColumns(sessions);
    expect(columns.status.notNull).toBe(true);
  });

  it("has selectedDirectionId as nullable", () => {
    const columns = getTableColumns(sessions);
    expect(columns.selectedDirectionId.notNull).toBe(false);
  });

  it("has refinementCount as non-nullable with default 0", () => {
    const columns = getTableColumns(sessions);
    expect(columns.refinementCount.notNull).toBe(true);
  });

  it("has refinementHistory as nullable", () => {
    const columns = getTableColumns(sessions);
    expect(columns.refinementHistory.notNull).toBe(false);
  });

  it("maps camelCase to snake_case column names", () => {
    const columns = getTableColumns(sessions);
    expect(columns.userId.name).toBe("user_id");
    expect(columns.briefText.name).toBe("brief_text");
    expect(columns.createdAt.name).toBe("created_at");
    expect(columns.updatedAt.name).toBe("updated_at");
    expect(columns.selectedDirectionId.name).toBe("selected_direction_id");
    expect(columns.selectedGenerationJobId.name).toBe("selected_generation_job_id");
    expect(columns.refinementCount.name).toBe("refinement_count");
    expect(columns.refinementHistory.name).toBe("refinement_history");
  });
});
