import { relations } from "drizzle-orm/_relations";
import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
  text,
  index,
} from "drizzle-orm/pg-core";

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

export const groupRelations = relations(groupsTable, ({ many }) => {
  return {
    logs: many(logsTable, {
      relationName: "group_log",
    }),
    notebooks: many(notebooksTable, {
      relationName: "notebook_group",
    }),
  };
});

export const groupMembersTable = pgTable(
  "group_members",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    groupId: integer("group_id")
      .references(() => groupsTable.id)
      .notNull(),
    currentStreak: integer("current_streak").default(0).notNull(),
    longestStreak: integer("longest_streak").default(0).notNull(),
    lastLogDate: timestamp("last_log_date"),
  },
  (t) => [
    index("member_user_idx").on(t.userId),
    index("member_group_idx").on(t.groupId),
  ],
);

export const logsTable = pgTable(
  "logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .references(() => usersTable.id)
      .notNull(),
    groupId: integer("group_id")
      .references(() => groupsTable.id)
      .notNull(),
    message: text("message").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => {
    return [
      index("logs_group_idx").on(t.groupId),
      index("logs_author_idx").on(t.userId),
    ];
  },
);

export const notebooksTable = pgTable(
  "notebooks",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }).notNull(),
    groupId: integer("group_id")
      .notNull()
      .references(() => groupsTable.id),
    createdBy: integer("created_by")
      .notNull()
      .references(() => usersTable.id),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => {
    return [
      index("notebook_group_idx").on(t.groupId),
      index("notebook_author_idx").on(t.createdBy),
    ];
  },
);

export const notebookRelations = relations(notebooksTable, ({ many, one }) => {
  return {
    items: many(notesTable, {
      relationName: "item_notebook",
    }),
    group: one(groupsTable, {
      fields: [notebooksTable.groupId],
      references: [groupsTable.id],
      relationName: "notebook_group",
    }),
    author: one(usersTable, {
      fields: [notebooksTable.createdBy],
      references: [usersTable.id],
      relationName: "notebook_author",
    }),
  };
});

export const notesTable = pgTable(
  "notes",
  {
    id: serial("id").primaryKey(),
    notebookId: integer("notebook_id")
      .notNull()
      .references(() => notebooksTable.id),
    authorId: integer("author_id")
      .notNull()
      .references(() => usersTable.id),
    content: varchar("name", { length: 256 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => {
    return [
      index("note_notebook_idx").on(t.notebookId),
      index("note_author_idx").on(t.authorId),
    ];
  },
);

export const noteRelations = relations(notesTable, ({ one }) => {
  return {
    items: one(notebooksTable, {
      fields: [notesTable.notebookId],
      references: [notebooksTable.id],
      relationName: "item_notebook",
    }),
    author: one(usersTable, {
      fields: [notesTable.authorId],
      references: [usersTable.id],
      relationName: "note_author",
    }),
  };
});
