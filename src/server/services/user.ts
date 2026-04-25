import "server-only";

import { db } from "@/server/db";
import { users } from "@/server/db/schema/users";
import { eq, sql } from "drizzle-orm";

export async function isPremiumUser(userId: string): Promise<boolean> {
  const [user] = await db
    .select({ isPremium: users.isPremium })
    .from(users)
    .where(eq(users.id, userId));

  return user?.isPremium ?? false;
}

export async function promoteUserToPremium(userId: string): Promise<void> {
  await db
    .update(users)
    .set({
      isPremium: true,
      premiumSince: sql`now()`,
      updatedAt: sql`now()`,
    })
    .where(eq(users.id, userId));
}
