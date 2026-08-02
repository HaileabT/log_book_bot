import { pgTable, serial, varchar, integer, timestamp, text } from "drizzle-orm/pg-core";

export const usersTable = pgTable("users", {
    id: serial("id").primaryKey(),
    tg_id: varchar("tg_id", { length: 256 }).unique().notNull(),
    firstName: varchar("first_name", { length: 256 }),
    username: varchar("username", { length: 256 }),
});

export const groupsTable = pgTable("groups", {
    id: serial("id").primaryKey(),
    tg_id: varchar("tg_id", { length: 256 }).unique().notNull(),
    title: varchar("title", { length: 256 }),
});

export const groupMembersTable = pgTable("group_members", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    groupId: integer("group_id").references(() => groupsTable.id).notNull(),
    currentStreak: integer("current_streak").default(0).notNull(),
    longestStreak: integer("longest_streak").default(0).notNull(),
    lastLogDate: timestamp("last_log_date"),
});

export const logsTable = pgTable("logs", {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => usersTable.id).notNull(),
    groupId: integer("group_id").references(() => groupsTable.id).notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
});