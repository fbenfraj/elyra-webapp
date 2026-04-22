import "server-only";

import { db } from "@/server/db";
import { sessions } from "@/server/db/schema/sessions";
import { desc, eq } from "drizzle-orm";

export async function createSession(userId: string, briefText: string) {
  const [session] = await db
    .insert(sessions)
    .values({ userId, briefText })
    .returning({ id: sessions.id });

  return session;
}

export async function listByUserId(userId: string) {
  return db
    .select({
      id: sessions.id,
      briefText: sessions.briefText,
      status: sessions.status,
      createdAt: sessions.createdAt,
    })
    .from(sessions)
    .where(eq(sessions.userId, userId))
    .orderBy(desc(sessions.createdAt));
}
