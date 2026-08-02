import { drizzle } from "drizzle-orm/node-postgres";
import { ENV } from "../env";


export const db = drizzle(ENV.databaseUrl || "");
