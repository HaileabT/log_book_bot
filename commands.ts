import { BotContext } from "./type";
import { getGroup, getGroupMember, getGroupStats, getRecentAllLogs, getRecentLogs, getUserByUsername, getUserStats, processLog, getOrCreateUser, getOrCreateGroup, createNotebook, getNotebook, getNotebookByName, getNotebooks, updateNotebook, deleteNotebook, createNote, getNotes, getNote, updateNote, deleteNote } from "./db/operations";
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

// ----------------------------------------------------
// NOTEBOOK COMMANDS
// ----------------------------------------------------

async function onNotebooks(ctx: BotContext) {
    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const group = await getOrCreateGroup(tgGroupId, groupTitle);
    if (!group) {
        await ctx.reply("> *Could not identify group.*", { parse_mode: "Markdown" });
        return;
    }

    const notebooks = await getNotebooks(group.id);

    if (notebooks.length === 0) {
        await ctx.reply(`> *No notebooks in ${groupTitle} yet.*\n> Create one using \`/create_notebook <name>\`!`, { parse_mode: "Markdown" });
        return;
    }

    let message = `**📓 Notebooks in ${groupTitle}**\n\n`;
    notebooks.forEach((nb, index) => {
        const creator = nb.authorUsername ? `@${nb.authorUsername}` : nb.authorFirstName || "User";
        message += `*${index + 1}. ${nb.name}* (ID: \`${nb.id}\`)\n> Created by ${creator}\n\n`;
    });
    message += `_View notes: \`/notebook <name_or_id>\`_\n_Add note: \`/note <name> <content>\`_`;

    await ctx.reply(message, { parse_mode: "Markdown" });
}

async function onNotebook(ctx: BotContext) {
    const match = (ctx.match as string || "").trim();

    if (!match) {
        return await onNotebooks(ctx);
    }

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const group = await getOrCreateGroup(tgGroupId, groupTitle);
    if (!group) {
        await ctx.reply("> *Could not identify group.*", { parse_mode: "Markdown" });
        return;
    }

    let notebook;
    const isNumeric = !isNaN(Number(match));
    if (isNumeric) {
        const id = parseInt(match, 10);
        const nb = await getNotebook(id);
        if (nb && nb.groupId === group.id) {
            notebook = nb;
        }
    }

    if (!notebook) {
        notebook = await getNotebookByName(group.id, match);
    }

    if (!notebook) {
        await ctx.reply(`> *Notebook '${match}' not found in this chat.*\n> Use \`/notebooks\` to see all notebooks.`, { parse_mode: "Markdown" });
        return;
    }

    const notes = await getNotes(notebook.id);
    const creator = notebook.authorUsername ? `@${notebook.authorUsername}` : notebook.authorFirstName || "User";

    if (notes.length === 0) {
        await ctx.reply(`**📓 Notebook: ${notebook.name}**\nCreated by ${creator}\n\n> *No notes in this notebook yet.*\n> Add a note with: \`/note "${notebook.name}" <your note>\``, { parse_mode: "Markdown" });
        return;
    }

    let message = `**📓 Notebook: ${notebook.name}**\nCreated by ${creator}\n\n`;
    notes.forEach((note, index) => {
        const author = note.authorUsername ? `@${note.authorUsername}` : note.authorFirstName || "User";
        message += `*${index + 1}. [${formatDate(note.createdAt)}]* (Note \`#${note.id}\`)\n> ${note.content}\n> by ${author}\n\n`;
    });

    await ctx.reply(message, { parse_mode: "Markdown" });
}

async function onCreateNotebook(ctx: BotContext) {
    const match = (ctx.match as string || "").trim().replace(/^["']|["']$/g, "");

    if (!match) {
        await ctx.reply("> *Please provide a notebook name.*\n> Example: `/create_notebook Work Ideas`", { parse_mode: "Markdown" });
        return;
    }

    const tgUserId = ctx.from?.id.toString() || "";
    const firstName = ctx.from?.first_name || "";
    const username = ctx.from?.username;

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const user = await getOrCreateUser(tgUserId, firstName, username);
    const group = await getOrCreateGroup(tgGroupId, groupTitle);

    if (!user || !group) {
        await ctx.reply("> *Could not create notebook. Please try again.*", { parse_mode: "Markdown" });
        return;
    }

    const existing = await getNotebookByName(group.id, match);
    if (existing) {
        await ctx.reply(`> *A notebook named '${existing.name}' already exists in this chat.* (ID: \`${existing.id}\`)`, { parse_mode: "Markdown" });
        return;
    }

    const notebook = await createNotebook(match, user.id, group.id);
    await ctx.reply(`*Notebook '${notebook.name}' created successfully!* 📓\n\n> Add notes to it with: \`/note "${notebook.name}" <your note>\``, { parse_mode: "Markdown" });
}

async function onRenameNotebook(ctx: BotContext) {
    const match = (ctx.match as string || "").trim();
    const toMatch = match.match(/^(.+?)\s+to\s+(.+)$/i);
    let target = "";
    let newName = "";

    if (toMatch && toMatch[1] && toMatch[2]) {
        target = toMatch[1].replace(/^["']|["']$/g, "").trim();
        newName = toMatch[2].replace(/^["']|["']$/g, "").trim();
    } else {
        const firstSpace = match.search(/\s/);
        if (firstSpace !== -1) {
            target = match.slice(0, firstSpace).trim().replace(/^["']|["']$/g, "");
            newName = match.slice(firstSpace + 1).trim().replace(/^["']|["']$/g, "");
        }
    }

    if (!target || !newName) {
        await ctx.reply("> *Please specify the notebook and its new name.*\n> Example: `/rename_notebook \"Old Name\" to \"New Name\"`\n> Or: `/rename_notebook 3 \"New Name\"`", { parse_mode: "Markdown" });
        return;
    }

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const group = await getOrCreateGroup(tgGroupId, groupTitle);
    if (!group) {
        await ctx.reply("> *Could not identify group.*", { parse_mode: "Markdown" });
        return;
    }

    let notebook;
    const isNumeric = !isNaN(Number(target));
    if (isNumeric) {
        const id = parseInt(target, 10);
        const nb = await getNotebook(id);
        if (nb && nb.groupId === group.id) {
            notebook = nb;
        }
    }

    if (!notebook) {
        notebook = await getNotebookByName(group.id, target);
    }

    if (!notebook) {
        await ctx.reply(`> *Notebook '${target}' not found in this chat.*`, { parse_mode: "Markdown" });
        return;
    }

    const updated = await updateNotebook(notebook.id, newName);
    await ctx.reply(`*Notebook renamed to '${updated.name}' successfully!* ✏️`, { parse_mode: "Markdown" });
}

async function onDeleteNotebook(ctx: BotContext) {
    const match = (ctx.match as string || "").trim().replace(/^["']|["']$/g, "");

    if (!match) {
        await ctx.reply("> *Please specify the notebook to delete.*\n> Example: `/delete_notebook Work` or `/delete_notebook 3`", { parse_mode: "Markdown" });
        return;
    }

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const group = await getOrCreateGroup(tgGroupId, groupTitle);
    if (!group) {
        await ctx.reply("> *Could not identify group.*", { parse_mode: "Markdown" });
        return;
    }

    let notebook;
    const isNumeric = !isNaN(Number(match));
    if (isNumeric) {
        const id = parseInt(match, 10);
        const nb = await getNotebook(id);
        if (nb && nb.groupId === group.id) {
            notebook = nb;
        }
    }

    if (!notebook) {
        notebook = await getNotebookByName(group.id, match);
    }

    if (!notebook) {
        await ctx.reply(`> *Notebook '${match}' not found in this chat.*`, { parse_mode: "Markdown" });
        return;
    }

    await deleteNotebook(notebook.id);
    await ctx.reply(`*Notebook '${notebook.name}' and all its notes have been deleted.* 🗑️`, { parse_mode: "Markdown" });
}

// ----------------------------------------------------
// NOTE COMMANDS
// ----------------------------------------------------

async function onNote(ctx: BotContext) {
    const text = (ctx.match as string || "").trim();

    if (!text) {
        await ctx.reply("> *Please specify a notebook and note content.*\n> Example: `/note Work Finished report`\n> Quoted notebook: `/note \"Daily Goals\" 10km run`", { parse_mode: "Markdown" });
        return;
    }

    let notebookName = "";
    let content = "";
    const quoted = text.match(/^["']([^"']+)["']\s*(.*)$/s);
    if (quoted && quoted[1]) {
        notebookName = quoted[1].trim();
        content = (quoted[2] || "").trim();
    } else {
        const firstSpace = text.search(/\s/);
        if (firstSpace === -1) {
            notebookName = text;
            content = "";
        } else {
            notebookName = text.slice(0, firstSpace).trim();
            content = text.slice(firstSpace + 1).trim();
        }
    }

    if (!notebookName || !content) {
        await ctx.reply("> *Please specify both a notebook and note content.*\n> Example: `/note Work Finished report`", { parse_mode: "Markdown" });
        return;
    }

    const tgUserId = ctx.from?.id.toString() || "";
    const firstName = ctx.from?.first_name || "";
    const username = ctx.from?.username;

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const user = await getOrCreateUser(tgUserId, firstName, username);
    const group = await getOrCreateGroup(tgGroupId, groupTitle);

    if (!user || !group) {
        await ctx.reply("> *Could not save note. Please try again.*", { parse_mode: "Markdown" });
        return;
    }

    let notebook;
    const isNumeric = !isNaN(Number(notebookName));
    if (isNumeric) {
        const id = parseInt(notebookName, 10);
        const nb = await getNotebook(id);
        if (nb && nb.groupId === group.id) {
            notebook = nb;
        }
    }

    if (!notebook) {
        notebook = await getNotebookByName(group.id, notebookName);
    }

    if (!notebook) {
        notebook = await createNotebook(notebookName, user.id, group.id);
    }

    const note = await createNote(content, user.id, notebook.id);
    await ctx.reply(`*Note added to '${notebook.name}'!* 📝\n\n> ${note.content}\n\n_Note ID: \`#${note.id}\`_`, { parse_mode: "Markdown" });
}

async function onNotes(ctx: BotContext) {
    return await onNotebook(ctx);
}

async function onEditNote(ctx: BotContext) {
    const text = (ctx.match as string || "").trim();
    const firstSpace = text.search(/\s/);
    const idStr = firstSpace === -1 ? text : text.slice(0, firstSpace).trim();
    const content = firstSpace === -1 ? "" : text.slice(firstSpace + 1).trim();
    const id = parseInt(idStr.replace("#", ""), 10);

    if (isNaN(id) || !content) {
        await ctx.reply("> *Please provide a note ID and the new content.*\n> Example: `/edit_note 4 Updated note text`", { parse_mode: "Markdown" });
        return;
    }

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const group = await getOrCreateGroup(tgGroupId, groupTitle);
    if (!group) {
        await ctx.reply("> *Could not identify group.*", { parse_mode: "Markdown" });
        return;
    }

    const note = await getNote(id);

    if (!note) {
        await ctx.reply(`> *Note #${id} not found.*`, { parse_mode: "Markdown" });
        return;
    }

    const notebook = await getNotebook(note.notebookId);
    if (!notebook || notebook.groupId !== group.id) {
        await ctx.reply(`> *Note #${id} not found in this chat.*`, { parse_mode: "Markdown" });
        return;
    }

    const updated = await updateNote(id, content);
    await ctx.reply(`*Note \`#${updated.id}\` updated successfully!* ✏️\n\n> ${updated.content}`, { parse_mode: "Markdown" });
}

async function onDeleteNote(ctx: BotContext) {
    const text = (ctx.match as string || "").trim().replace("#", "");
    const id = parseInt(text, 10);

    if (isNaN(id)) {
        await ctx.reply("> *Please provide a valid note ID to delete.*\n> Example: `/delete_note 4`", { parse_mode: "Markdown" });
        return;
    }

    const tgGroupId = ctx.chat?.id.toString() || "";
    let groupTitle = "Private Chat";
    if (ctx.chat?.type !== "private") {
        groupTitle = (ctx.chat as any).title || "Group";
    }

    const group = await getOrCreateGroup(tgGroupId, groupTitle);
    if (!group) {
        await ctx.reply("> *Could not identify group.*", { parse_mode: "Markdown" });
        return;
    }

    const note = await getNote(id);

    if (!note) {
        await ctx.reply(`> *Note #${id} not found.*`, { parse_mode: "Markdown" });
        return;
    }

    const notebook = await getNotebook(note.notebookId);
    if (!notebook || notebook.groupId !== group.id) {
        await ctx.reply(`> *Note #${id} not found in this chat.*`, { parse_mode: "Markdown" });
        return;
    }

    await deleteNote(id);
    await ctx.reply(`*Note \`#${id}\` deleted successfully.* 🗑️`, { parse_mode: "Markdown" });
}

async function onHelp(ctx: BotContext) {
    const helpText = `*Welcome to Log Book Bot!* 📝

Here is a list of commands you can use to track activities and manage notebooks:

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

**Notebooks** 📓
🔸 **/notebooks**
List all notebooks in the current chat.

🔸 **/notebook [name or id]**
View notes in a specific notebook.
> Example: \`/notebook Work\` or \`/notebook 1\`

🔸 **/create_notebook [name]**
Create a new notebook.
> Example: \`/create_notebook Ideas\`

🔸 **/rename_notebook [name/id] to [new_name]**
Rename a notebook.
> Example: \`/rename_notebook "Work" to "Work Projects"\`

🔸 **/delete_notebook [name or id]**
Delete a notebook and all its notes.
> Example: \`/delete_notebook Ideas\`

**Notes** 📝
🔸 **/note [notebook] [content]**
Add a note to a notebook (creates notebook automatically if not found).
> Example: \`/note Work Submitted draft report\`
> Quoted name: \`/note "My Goals" Run 5 miles\`

🔸 **/notes [notebook]**
View all notes in a notebook (same as \`/notebook\`).

🔸 **/edit_note [id] [new_content]**
Edit a note by its ID.
> Example: \`/edit_note 5 Revised report draft\`

🔸 **/delete_note [id]**
Delete a note by its ID.
> Example: \`/delete_note 5\`

**Other**
🔸 **/help**
Shows this help message.`;

    await ctx.reply(helpText, { parse_mode: "Markdown" });
}

export const commands = { onLog, onStats, onRecent, onNotebooks, onNotebook, onCreateNotebook, onRenameNotebook, onDeleteNotebook, onNote, onNotes, onEditNote, onDeleteNote, onHelp }