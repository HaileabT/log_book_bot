import { Bot, session } from "grammy";
import http from "http";

import { ENV } from "./env";
import { BotContext } from "./type";

import { startDailyReportJob } from "./jobs/dailyReport";
import { commands } from "./commands";
import { heartbeat } from "./jobs/ping";

const bot = new Bot<BotContext>(ENV.botToken || "");

bot.use(session({ initial: () => ({}) }));

bot.command("log", commands.onLog);
bot.command("stats", commands.onStats);
bot.command("recent", commands.onRecent);
bot.command("notebooks", commands.onNotebooks);
bot.command("notebook", commands.onNotebook);
bot.command("create_notebook", commands.onCreateNotebook);
bot.command("rename_notebook", commands.onRenameNotebook);
bot.command("delete_notebook", commands.onDeleteNotebook);
bot.command("note", commands.onNote);
bot.command("notes", commands.onNotes);
bot.command("edit_note", commands.onEditNote);
bot.command("delete_note", commands.onDeleteNote);
bot.command("help", commands.onHelp);


bot.inlineQuery("log", commands.onLog);
bot.inlineQuery("stats", commands.onStats);
bot.inlineQuery("recent", commands.onRecent);
bot.inlineQuery("notebooks", commands.onNotebooks);
bot.inlineQuery("notebook", commands.onNotebook);
bot.inlineQuery("note", commands.onNote);
bot.inlineQuery("notes", commands.onNotes);
bot.inlineQuery("help", commands.onHelp);

// Set Telegram command menu
bot.api.setMyCommands([
    { command: "log", description: "Log an activity" },
    { command: "recent", description: "View recent logs" },
    { command: "stats", description: "View your stats and streaks" },
    { command: "notebooks", description: "List all notebooks" },
    { command: "notebook", description: "View a notebook and its notes" },
    { command: "create_notebook", description: "Create a new notebook" },
    { command: "note", description: "Add a note to a notebook" },
    { command: "notes", description: "View notes in a notebook" },
    { command: "delete_notebook", description: "Delete a notebook" },
    { command: "edit_note", description: "Edit a note by ID" },
    { command: "delete_note", description: "Delete a note by ID" },
    { command: "help", description: "Show help information" }
]);

heartbeat();
startDailyReportJob(bot as any);
bot.start();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {

    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running!");
}).listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});