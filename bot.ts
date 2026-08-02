import { Bot, session } from "grammy";
import http from "http";

import { ENV } from "./env";
import { BotContext } from "./type";

import { startDailyReportJob } from "./jobs/dailyReport";
import { commands } from "./commands";

const bot = new Bot<BotContext>(ENV.botToken || "");

bot.use(session({ initial: () => ({}) }));

bot.command("log", commands.onLog);
bot.command("stats", commands.onStats);
bot.command("recent", commands.onRecent);
bot.command("help", commands.onHelp);


bot.inlineQuery("log", commands.onLog);
bot.inlineQuery("stats", commands.onStats);
bot.inlineQuery("recent", commands.onRecent);
bot.inlineQuery("help", commands.onHelp);

// Set Telegram command menu
bot.api.setMyCommands([
    { command: "log", description: "Log an activity" },
    { command: "recent", description: "View recent logs" },
    { command: "stats", description: "View your stats and streaks" },
    { command: "help", description: "Show help information" }
]);

startDailyReportJob(bot as any);
bot.start();

const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Bot is running!");
}).listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
});