import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, like } from "drizzle-orm";
import { sessions } from "@/server/db/schema/sessions";
import { payments } from "@/server/db/schema/payments";
import { processedEvents } from "@/server/db/schema/processed-events";
import { users } from "@/server/db/schema/users";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is not set for E2E tests");
}

const testClient = postgres(connectionString);
export const testDb = drizzle(testClient);

export function createTestUserId(): string {
  return `test-user-${crypto.randomUUID()}`;
}

export async function createTestUser(userId: string): Promise<void> {
  await testDb.insert(users).values({ id: userId });
}

export async function cleanupTestUser(userId: string): Promise<void> {
  // Delete in reverse dependency order to respect FK constraints
  await testDb
    .delete(processedEvents)
    .where(like(processedEvents.eventKey, `%${userId}%`));
  await testDb.delete(payments).where(eq(payments.userId, userId));
  await testDb.delete(sessions).where(eq(sessions.userId, userId));
  await testDb.delete(users).where(eq(users.id, userId));
}

export async function closeTestConnection(): Promise<void> {
  await testClient.end();
}
