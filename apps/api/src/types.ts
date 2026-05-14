import type { Env } from "./index";
import type { createDb } from "./db/index";

// Shared type for Hono app bindings + variables
export type AppVariables = {
  userId: string;
  clerkUserId: string;
  internalUserId: string;
  db: ReturnType<typeof createDb>;
};

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};
