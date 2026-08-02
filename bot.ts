import { Bot, session } from "grammy";

import { ENV } from "./env";
import { BotContext } from "./type";

import { startDailyReportJob } from "./jobs/dailyReport";
import { commands } from "./commands";

const bot = new Bot<BotContext>(ENV.botToken || "");

bot.use(session({ initial: () => ({}) }));

bot.command("log", commands.onLog);
bot.command("stats", commands.onStats);
bot.command("recent", commands.onRecent);

startDailyReportJob(bot as any);
bot.start();