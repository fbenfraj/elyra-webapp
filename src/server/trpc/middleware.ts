import "server-only";

// Auth middleware (authedProcedure) is defined in init.ts.
// Re-export for convenience. Additional middleware (rate limiting, etc.) can be added here.
export { authedProcedure } from "@/server/trpc/init";
