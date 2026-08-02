import cron from "node-cron";

export function heartbeat() {
    cron.schedule("*/5 * * * *", async () => {
        console.log("i am alive", new Date().toISOString());
    });
}