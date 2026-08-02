import cron from "node-cron";
import { Bot } from "grammy";
import { db } from "../db";
import { logsTable, usersTable, groupsTable, groupMembersTable } from "../db/schema";
import { eq, and, gte, lt } from "drizzle-orm";

export function startDailyReportJob(bot: Bot<any>) {
    cron.schedule("59 23 * * *", async () => {
        console.log("Running daily report job...");

        const now = new Date();
        const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const endOfDay = new Date(startOfDay);
        endOfDay.setUTCDate(endOfDay.getUTCDate() + 1);

        // Fetch logs for today
        const todayLogs = await db.select({
            logId: logsTable.id,
            message: logsTable.message,
            tgGroupId: groupsTable.tg_id,
            groupTitle: groupsTable.title,
            firstName: usersTable.firstName,
            username: usersTable.username,
            currentStreak: groupMembersTable.currentStreak,
        })
            .from(logsTable)
            .innerJoin(groupsTable, eq(logsTable.groupId, groupsTable.id))
            .innerJoin(usersTable, eq(logsTable.userId, usersTable.id))
            .innerJoin(groupMembersTable, and(
                eq(groupMembersTable.userId, usersTable.id),
                eq(groupMembersTable.groupId, groupsTable.id)
            ))
            .where(and(
                gte(logsTable.createdAt, startOfDay),
                lt(logsTable.createdAt, endOfDay)
            ));

        // Group logs by tgGroupId
        const logsByGroup: Record<string, typeof todayLogs> = {};
        for (const log of todayLogs) {
            if (!logsByGroup[log.tgGroupId]) {
                logsByGroup[log.tgGroupId] = [];
            }
            if (!logsByGroup) return;
            logsByGroup[log.tgGroupId]!.push(log);
        }

        for (const [tgGroupId, logs] of Object.entries(logsByGroup)) {
            let message = "📝 *Daily Logs Summary* \n\n";
            for (const log of logs) {
                const displayName = log.username ? `@${log.username}` : log.firstName;
                message += `${displayName} (Streak:  ${log.currentStreak}):\n_"${log.message}"_\n\n`;
            }

            try {
                await bot.api.sendMessage(tgGroupId, message, { parse_mode: "Markdown" });
            } catch (err) {
                console.error(`Failed to send report to group ${tgGroupId}:`, err);
            }
        }
    });
}
