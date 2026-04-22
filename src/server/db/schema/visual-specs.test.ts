import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import { visualSpecs } from "./visual-specs";

describe("visual_specs schema", () => {
  it("has the correct table name", () => {
    expect(getTableName(visualSpecs)).toBe("visual_specs");
  });

  it("has the expected columns", () => {
    const columns = getTableColumns(visualSpecs);
    expect(Object.keys(columns)).toEqual([
      "id",
      "sessionId",
      "specData",
      "createdAt",
    ]);
  });

  it("has sessionId as non-nullable", () => {
    const columns = getTableColumns(visualSpecs);
    expect(columns.sessionId.notNull).toBe(true);
  });

  it("has specData as non-nullable", () => {
    const columns = getTableColumns(visualSpecs);
    expect(columns.specData.notNull).toBe(true);
  });

  it("maps camelCase to snake_case column names", () => {
    const columns = getTableColumns(visualSpecs);
    expect(columns.sessionId.name).toBe("session_id");
    expect(columns.specData.name).toBe("spec_data");
    expect(columns.createdAt.name).toBe("created_at");
  });
});
