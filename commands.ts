import { BotContext } from "./type";
import { getGroup, getGroupMember, getRecentAllLogs, getRecentLogs, getUserByUsername, getUserStats, processLog } from "./db/operations";

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

function formatDate(date: Date) {
    return new Intl.DateTimeFormat('en-US', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: 'numeric', minute: '2-digit', hour12: true
    }).format(date);
}

async function onRecent(ctx: BotContext) {
    let tgUserId = ctx.from?.id.toString();
    const tgGroupId = ctx.chat?.id.toString();

    if (!tgUserId || !tgGroupId) {
        await ctx.reply("> *Could not identify user or group.*", { parse_mode: "Markdown" });
        return;
    }

    let recentAmount = 5;
    let username = "";
    let isAll = false;
    let isUser = false;
    const match = ctx.match as string;

    if (match && match.trim() !== "") {
        const parts = match.trim().split(/\s+/);
        if (parts[0]?.toLowerCase() === "all") {
            isAll = true;
            if (parts[1] && !isNaN(Number(parts[1]))) {
                recentAmount = parseInt(parts[1], 10);
            }
        } else if (parts[0]?.startsWith("@")) {
            isUser = true;
            username = parts[0].slice(1);
            if (parts[1] && !isNaN(Number(parts[1]))) {
                recentAmount = parseInt(parts[1], 10);
            }
        } else if (!isNaN(Number(parts[0]))) {
            recentAmount = parseInt(parts[0]!, 10);
        }
    }

    if (isAll) {
        const logs = await getRecentAllLogs(tgGroupId, recentAmount);

        if (logs.length === 0) {
            await ctx.reply("> *No logs in this group yet.*", { parse_mode: "Markdown" });
            return;
        }

        const group = await getGroup(tgGroupId);
        const groupTitle = group?.title || "Group";

        let message = `**Recent Logs for ${groupTitle}**\n\n`;

        logs.forEach((log, index) => {
            const username = log.username || "unknown_user";
            message += `*${index + 1}. [${formatDate(log.createdAt)}]*\n> ${log.message}\n> _by @${username}_\n\n`;
        });

        await ctx.reply(message, { parse_mode: "Markdown" });
    } else {

        if (isUser) {
            const group = await getGroup(tgGroupId);
            const user = await getUserByUsername(username.trim());
            console.log("Asked log for", username)
            if (user && group) {
                const member = await getGroupMember(group.id, user.id);
                if (member) {
                    tgUserId = user.tg_id;
                } else {
                    await ctx.reply("> *Member not found.*", { parse_mode: "Markdown" });
                    return;
                }
            } else {
                await ctx.reply("> *User or group not found.*", { parse_mode: "Markdown" });
                return;
            }
        }

        const logs = await getRecentLogs(tgUserId, tgGroupId, recentAmount);

        if (logs.length === 0) {
            await ctx.reply("> *You haven't logged any activity in this group yet.*", { parse_mode: "Markdown" });
            return;
        }

        const displayName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";
        let message = `**Recent Logs for ${isUser ? `@${username}` : displayName}**\n\n`;

        logs.forEach((log, index) => {
            message += `*${index + 1}. [${formatDate(log.createdAt)}]*\n> ${log.message}\n\n`;
        });

        await ctx.reply(message, { parse_mode: "Markdown" });
    }
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