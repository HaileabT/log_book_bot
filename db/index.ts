import { drizzle } from "drizzle-orm/node-postgres";
import { ENV } from "../env";

export const db: ReturnType<typeof drizzle> = drizzle(ENV.databaseUrl || "");
