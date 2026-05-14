import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
import type { DrizzleD1Database } from "drizzle-orm/d1";

export type Database = DrizzleD1Database<typeof schema> & { schema: typeof schema };

export function createDb(d1Binding: D1Database): Database {
  const db = drizzle(d1Binding, { schema });
  return Object.assign(db, { schema });
}
