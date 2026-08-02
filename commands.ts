import { BotContext } from "./type";
import { getRecentLogs, getUserStats, processLog } from "./db/operations";

async function onLog(ctx: BotContext) {
    const text = ctx.match as string;

    if (!text) {
        await ctx.reply("Please provide a log message. Example: /log I finished my workout!");
        return;
    }

    // One-shot log
    const tgUserId = ctx.from?.id.toString() || "";
    const firstName = ctx.from?.first_name || "";
    const username = ctx.from?.username;

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const stats = await processLog(tgUserId, firstName, username, tgGroupId, groupTitle, text);

    if (!stats) {

        return await ctx.reply("Couldn't save your log.")
    }

    await ctx.reply(
        `Log saved! 📝\nYour current streak is  ${stats.currentStreak} and your longest streak is  ${stats.longestStreak}.`
    );
}

async function onRecent(ctx: BotContext) {
    const tgUserId = ctx.from?.id.toString();
    const tgGroupId = ctx.chat?.id.toString();

    if (!tgUserId || !tgGroupId) {
        await ctx.reply("Could not identify user or group.");
        return;
    }

    const logs = await getRecentLogs(tgUserId, tgGroupId, 5);

    if (logs.length === 0) {
        await ctx.reply("You haven't logged any activity in this group yet.");
        return;
    }

    const displayName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";

    let message = ` **Recent 5 Logs for ${displayName}**\n\n`;

    logs.forEach((log, index) => {
        // Format date simply
        const dateStr = log.createdAt.toISOString().split('T')[0];
        const timeStr = log.createdAt.toTimeString().split(' ')[0];

        message += `**${index + 1}. [${dateStr} ${timeStr}]**\n_${log.message}_\n\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
}

async function onStats(ctx: BotContext) {
    const tgUserId = ctx.from?.id.toString();
    const tgGroupId = ctx.chat?.id.toString();

    if (!tgUserId || !tgGroupId) {
        await ctx.reply("Could not identify user or group.");
        return;
    }

    const stats = await getUserStats(tgUserId, tgGroupId);

    if (!stats) {
        await ctx.reply("You haven't logged any activity in this group yet. Try using /log first!");
        return;
    }

    const displayName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";

    await ctx.reply(
        ` **Stats for ${displayName}**\n\n Current Streak: ${stats.currentStreak}\n Longest Streak: ${stats.longestStreak}`,
        { parse_mode: "Markdown" }
    );
}



export const commands = { onLog, onStats, onRecent }