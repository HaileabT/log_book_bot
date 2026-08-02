import { config } from "dotenv";
config({ quiet: true, path: ".env" });

export const ENV = {
    botToken: process.env.BOT_TOKEN,
    databaseUrl: process.env.DATABASE_URL
}

