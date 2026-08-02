import { BotContext } from "./type";
import { getRecentLogs, getUserStats, processLog } from "./db/operations";

async function onLog(ctx: BotContext) {
    const text = ctx.match as string;

    if (!text) {
        await ctx.reply("> *Please provide a log message.*\n> Example: `/log I finished my workout!`", { parse_mode: "Markdown" });
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
        return await ctx.reply("> *Couldn't save your log. Please try again.*", { parse_mode: "Markdown" });
    }

    await ctx.reply(
        `*Log saved successfully.*\n\n**Current Streak:** ${stats.currentStreak}\n**Longest Streak:** ${stats.longestStreak}`,
        { parse_mode: "Markdown" }
    );
}

async function onRecent(ctx: BotContext) {
    const tgUserId = ctx.from?.id.toString();
    const tgGroupId = ctx.chat?.id.toString();

    if (!tgUserId || !tgGroupId) {
        await ctx.reply("> *Could not identify user or group.*", { parse_mode: "Markdown" });
        return;
    }

    let recentAmount = 5;
    const match = ctx.match as string;
    if (match && match.trim() !== "" && !isNaN(Number(match.trim()))) {
        recentAmount = parseInt(match.trim(), 10);
    }


    const logs = await getRecentLogs(tgUserId, tgGroupId, recentAmount);

    if (logs.length === 0) {
        await ctx.reply("> *You haven't logged any activity in this group yet.*", { parse_mode: "Markdown" });
        return;
    }

    const displayName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";

    let message = `**Recent Logs for ${displayName}**\n\n`;

    logs.forEach((log, index) => {
        const formattedDate = new Intl.DateTimeFormat('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        }).format(log.createdAt);

        message += `*${index + 1}. [${formattedDate}]*\n> ${log.message}\n\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
}

async function onStats(ctx: BotContext) {
    const tgUserId = ctx.from?.id.toString();
    const tgGroupId = ctx.chat?.id.toString();

    if (!tgUserId || !tgGroupId) {
        await ctx.reply("> *Could not identify user or group.*", { parse_mode: "Markdown" });
        return;
    }

    const stats = await getUserStats(tgUserId, tgGroupId);

    if (!stats) {
        await ctx.reply("> *You haven't logged any activity in this group yet.*\n> Try using `/log` first!", { parse_mode: "Markdown" });
        return;
    }

    const displayName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";

    await ctx.reply(
        `**Stats for ${displayName}**\n\n**Current Streak:** ${stats.currentStreak}\n**Longest Streak:** ${stats.longestStreak}`,
        { parse_mode: "Markdown" }
    );
}



export const commands = { onLog, onStats, onRecent }