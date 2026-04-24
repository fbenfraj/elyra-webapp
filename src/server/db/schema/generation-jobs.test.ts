import { describe, it, expect, vi } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";

vi.mock("server-only", () => ({}));

import { generationJobs } from "./generation-jobs";

describe("generation_jobs schema", () => {
  it("has the correct table name", () => {
    expect(getTableName(generationJobs)).toBe("generation_jobs");
  });

  it("has the expected columns", () => {
    const columns = getTableColumns(generationJobs);
    expect(Object.keys(columns)).toEqual([
      "id",
      "sessionId",
      "visualSpecId",
      "directionData",
      "status",
      "createdAt",
    ]);
  });

  it("has sessionId as non-nullable", () => {
    const columns = getTableColumns(generationJobs);
    expect(columns.sessionId.notNull).toBe(true);
  });

  it("has visualSpecId as non-nullable", () => {
    const columns = getTableColumns(generationJobs);
    expect(columns.visualSpecId.notNull).toBe(true);
  });

  it("has directionData as non-nullable", () => {
    const columns = getTableColumns(generationJobs);
    expect(columns.directionData.notNull).toBe(true);
  });

  it("has status as non-nullable", () => {
    const columns = getTableColumns(generationJobs);
    expect(columns.status.notNull).toBe(true);
  });

  it("maps camelCase to snake_case column names", () => {
    const columns = getTableColumns(generationJobs);
    expect(columns.sessionId.name).toBe("session_id");
    expect(columns.visualSpecId.name).toBe("visual_spec_id");
    expect(columns.directionData.name).toBe("direction_data");
    expect(columns.createdAt.name).toBe("created_at");
  });
});
