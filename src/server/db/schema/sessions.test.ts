import { describe, it, expect } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
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

  it("maps camelCase to snake_case column names", () => {
    const columns = getTableColumns(sessions);
    expect(columns.userId.name).toBe("user_id");
    expect(columns.briefText.name).toBe("brief_text");
    expect(columns.createdAt.name).toBe("created_at");
    expect(columns.updatedAt.name).toBe("updated_at");
  });
});
