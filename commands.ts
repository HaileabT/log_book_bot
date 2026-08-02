import { BotContext } from "./type";
import { getGroup, getGroupMember, getGroupStats, getRecentAllLogs, getRecentLogs, getUserByUsername, getUserStats, processLog } from "./db/operations";
import { extractAllUserOrDefault } from "./utils";

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

    const { recentAmount, username, isAll, isUser } = extractAllUserOrDefault(ctx.match?.toString() || "")

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
    let tgUserId = ctx.from?.id.toString();
    const tgGroupId = ctx.chat?.id.toString();

    if (!tgUserId || !tgGroupId) {
        await ctx.reply("> *Could not identify user or group.*", { parse_mode: "Markdown" });
        return;
    }

    const { username, isAll, isUser } = extractAllUserOrDefault(ctx.match?.toString() || "")

    if (isAll) {
        const stats = await getGroupStats(tgGroupId);
        if (!stats) {
            await ctx.reply("> *Nothing has been logged in this group yet.*\n> Try using `/log` first!", { parse_mode: "Markdown" });
            return;
        }


        const group = await getGroup(tgGroupId);
        if (!group) {
            await ctx.reply("> *Nothing has been logged in this group yet.*\n> Try using `/log` first!", { parse_mode: "Markdown" });
            return;
        }
        const displayName = group.title || "Private Group"


        await ctx.reply(
            `**Stats for ${displayName}**\n\n ${stats.map(s => `@${s.member || "Private User"}\n**Current Streak:** ${s.currentStreak}\n**Longest Streak:** ${s.longestStreak}`).join("\n\n")}`,
            { parse_mode: "Markdown" }
        );
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


        const stats = await getUserStats(tgUserId, tgGroupId);

        if (!stats) {
            await ctx.reply("> *You haven't logged any activity in this group yet.*\n> Try using `/log` first!", { parse_mode: "Markdown" });
            return;
        }

        const displayName = ctx.from?.username ? `@${ctx.from.username}` : ctx.from?.first_name || "User";

        await ctx.reply(
            `**Stats for ${isUser ? `@${username}` : displayName}**\n\n**Current Streak:** ${stats.currentStreak}\n**Longest Streak:** ${stats.longestStreak}`,
            { parse_mode: "Markdown" }
        );
    }


}


async function onHelp(ctx: BotContext) {
    const helpText = `*Welcome to Log Book Bot!* 📝

Here is a list of commands you can use to track and monitor your activities:

**Logging**
🔸 **/log [message]**
Logs an activity for today and updates your streak.
> Example: \`/log Finished reading chapter 3\`

**Recent Logs**
🔸 **/recent** _(or /recent [amount])_
View your recent logs in the current group.
> Example: \`/recent 10\`

🔸 **/recent @username** _(or /recent @username [amount])_
View recent logs for a specific user.
> Example: \`/recent @johndoe 3\`

🔸 **/recent all** _(or /recent all [amount])_
View recent logs from everyone in the group.
> Example: \`/recent all 10\`

**Statistics & Streaks**
🔸 **/stats**
View your current and longest streaks in this group.

🔸 **/stats @username**
View streaks for a specific user in this group.
> Example: \`/stats @johndoe\`

🔸 **/stats all**
View the streaks of everyone in the group.
> Example: \`/stats all\`

**Other**
🔸 **/help**
Shows this help message.`;

    await ctx.reply(helpText, { parse_mode: "Markdown" });
}

export const commands = { onLog, onStats, onRecent, onHelp }