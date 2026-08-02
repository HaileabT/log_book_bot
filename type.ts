import { Context, SessionFlavor } from "grammy";

export type SessionData = {}

export type BotContext = Context & SessionFlavor<SessionData>;