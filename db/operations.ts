import { eq, and, desc, ilike } from "drizzle-orm";
import { db } from "./index";
import { usersTable, groupsTable, groupMembersTable, logsTable, notebooksTable, notesTable } from "./schema";


export async function getGroup(tg_id: string) {
    const [group] = await db.select().from(groupsTable).where(ilike(groupsTable.tg_id, tg_id)).limit(1);
    return group;
}

export async function getUserByUsername(username: string) {
    const [user] = await db.select().from(usersTable).where(ilike(usersTable.username, username)).limit(1)
    return user;
}

export async function getGroupMember(groupId: number, userId: number) {
    const [member] = await db.select().from(groupMembersTable).where(and(eq(groupMembersTable.userId, userId), eq(groupMembersTable.groupId, groupId))).limit(1)
    return member;
}

export async function processLog(
    tgUserId: string,
    firstName: string,
    username: string | undefined,
    tgGroupId: string,
    groupTitle: string,
    message: string
) {
    // Upsert User
    const [user] = await db.insert(usersTable)
        .values({ tg_id: tgUserId, firstName, username })
        .onConflictDoUpdate({
            target: usersTable.tg_id,
            set: { firstName, username }
        })
        .returning();



    // Upsert Group
    const [group] = await db.insert(groupsTable)
        .values({ tg_id: tgGroupId, title: groupTitle })
        .onConflictDoUpdate({
            target: groupsTable.tg_id,
            set: { title: groupTitle }
        })
        .returning();

    if (!user || !group) {
        return
    }

    // Fetch Group Member
    const existingMember = await db.select().from(groupMembersTable)
        .where(and(
            eq(groupMembersTable.userId, user.id),
            eq(groupMembersTable.groupId, group.id)
        )).execute().then(res => res[0]);

    const now = new Date();
    // Normalize to start of day (local time or UTC, let's use UTC for simplicity)
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    let currentStreak = 1;
    let longestStreak = 1;
    let lastLogDate = today;

    if (existingMember && existingMember.lastLogDate) {
        const lastLog = new Date(existingMember.lastLogDate);
        const lastLogDay = new Date(Date.UTC(lastLog.getUTCFullYear(), lastLog.getUTCMonth(), lastLog.getUTCDate()));

        const diffDays = Math.floor((today.getTime() - lastLogDay.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 0) {
            // Already logged today
            currentStreak = existingMember.currentStreak || 1;
            longestStreak = existingMember.longestStreak || 1;
        } else if (diffDays === 1) {
            // Logged yesterday
            currentStreak = (existingMember.currentStreak || 0) + 1;
            longestStreak = Math.max(currentStreak, existingMember.longestStreak || 1);
        } else {
            // Missed a day
            currentStreak = 1;
            longestStreak = existingMember.longestStreak || 1;
        }
    }

    // Upsert Member
    if (!existingMember) {
        await db.insert(groupMembersTable).values({
            userId: user.id,
            groupId: group.id,
            currentStreak,
            longestStreak,
            lastLogDate: today,
        });
    } else {
        await db.update(groupMembersTable)
            .set({ currentStreak, longestStreak, lastLogDate: today })
            .where(eq(groupMembersTable.id, existingMember.id));
    }

    // Insert Log
    await db.insert(logsTable).values({
        userId: user.id,
        groupId: group.id,
        message,
    });

    return { currentStreak, longestStreak };
}

export async function getUserStats(tgUserId: string, tgGroupId: string) {
    const user = await db.select().from(usersTable).where(eq(usersTable.tg_id, tgUserId)).execute().then(res => res[0]);
    if (!user) return null;

    const group = await db.select().from(groupsTable).where(eq(groupsTable.tg_id, tgGroupId)).execute().then(res => res[0]);
    if (!group) return null;

    const member = await db.select().from(groupMembersTable)
        .where(and(
            eq(groupMembersTable.userId, user.id),
            eq(groupMembersTable.groupId, group.id)
        )).execute().then(res => res[0]);

    if (!member) return null;

    return {
        currentStreak: member.currentStreak,
        longestStreak: member.longestStreak,
        lastLogDate: member.lastLogDate
    };
}

export async function getGroupStats(tgGroupId: string) {
    const group = await db.select().from(groupsTable).where(eq(groupsTable.tg_id, tgGroupId)).execute().then(res => res[0]);
    if (!group) return null;

    const member = await db.select().from(groupMembersTable)
        .where(and(
            eq(groupMembersTable.groupId, group.id)
        )).leftJoin(usersTable, eq(groupMembersTable.userId, usersTable.id));

    if (!member || member.length < 1) return null;

    return member.map(m => ({
        currentStreak: m.group_members.currentStreak,
        longestStreak: m.group_members.longestStreak,
        lastLogDate: m.group_members.lastLogDate,
        member: m.users?.username
    }))
}

export async function getRecentLogs(tgUserId: string, tgGroupId: string, limitCount: number = 5) {
    const user = await db.select().from(usersTable).where(eq(usersTable.tg_id, tgUserId)).execute().then(res => res[0]);
    if (!user) return [];

    const group = await db.select().from(groupsTable).where(eq(groupsTable.tg_id, tgGroupId)).execute().then(res => res[0]);
    if (!group) return [];

    const recentLogs = await db.select({
        id: logsTable.id,
        message: logsTable.message,
        createdAt: logsTable.createdAt
    })
        .from(logsTable)
        .where(and(
            eq(logsTable.userId, user.id),
            eq(logsTable.groupId, group.id)
        ))
        .orderBy(desc(logsTable.createdAt))
        .limit(limitCount);

    return recentLogs;
}

export async function getRecentAllLogs(tgGroupId: string, limitCount: number = 5) {
    const group = await db.select().from(groupsTable).where(eq(groupsTable.tg_id, tgGroupId)).execute().then(res => res[0]);
    if (!group) return [];

    const recentLogs = await db.select({
        id: logsTable.id,
        message: logsTable.message,
        createdAt: logsTable.createdAt,
        username: usersTable.username
    })
        .from(logsTable)
        .where(and(
            eq(logsTable.groupId, group.id)
        )).leftJoin(usersTable, eq(logsTable.userId, usersTable.id))
        .orderBy(desc(logsTable.createdAt))
        .limit(limitCount);

    return recentLogs;
}

export async function getOrCreateUser(tgUserId: string, firstName: string, username?: string) {
    const [user] = await db.insert(usersTable)
        .values({ tg_id: tgUserId, firstName, username })
        .onConflictDoUpdate({
            target: usersTable.tg_id,
            set: { firstName, username }
        })
        .returning();
    return user;
}

export async function getOrCreateGroup(tgGroupId: string, title: string) {
    const [group] = await db.insert(groupsTable)
        .values({ tg_id: tgGroupId, title })
        .onConflictDoUpdate({
            target: groupsTable.tg_id,
            set: { title }
        })
        .returning();
    return group;
}

export async function createNotebook(name: string, authorId: number, groupId: number) {
    const [notebook] = await db.insert(notebooksTable)
        .values({ name, createdBy: authorId, groupId })
        .returning();

    if (!notebook) {
        throw new Error("Error creating the notebook");
    }

    return notebook;
}

export async function getNotebook(notebookId: number) {
    const [notebook] = await db.select().from(notebooksTable)
        .where(eq(notebooksTable.id, notebookId))
        .leftJoin(usersTable, eq(notebooksTable.createdBy, usersTable.id))
        .limit(1);

    if (!notebook) return null;
    return {
        ...notebook.notebooks,
        authorUsername: notebook.users?.username,
        authorFirstName: notebook.users?.firstName,
    };
}

export async function getNotebookByName(groupId: number, name: string) {
    const [notebook] = await db.select().from(notebooksTable)
        .where(and(eq(notebooksTable.groupId, groupId), ilike(notebooksTable.name, name.trim())))
        .leftJoin(usersTable, eq(notebooksTable.createdBy, usersTable.id))
        .limit(1);

    if (!notebook) return null;
    return {
        ...notebook.notebooks,
        authorUsername: notebook.users?.username,
        authorFirstName: notebook.users?.firstName,
    };
}

export async function getNotebooks(groupId: number) {
    const notebooks = await db.select().from(notebooksTable)
        .where(eq(notebooksTable.groupId, groupId))
        .leftJoin(usersTable, eq(notebooksTable.createdBy, usersTable.id))
        .orderBy(desc(notebooksTable.createdAt));

    return notebooks.map(nb => ({
        ...nb.notebooks,
        authorUsername: nb.users?.username,
        authorFirstName: nb.users?.firstName,
    }));
}

export async function updateNotebook(notebookId: number, newName: string) {
    const [notebook] = await db.update(notebooksTable)
        .set({ name: newName.trim() })
        .where(eq(notebooksTable.id, notebookId))
        .returning();

    if (!notebook) {
        throw new Error("Error updating the notebook");
    }

    return notebook;
}

export async function deleteNotebook(notebookId: number) {
    await db.delete(notesTable).where(eq(notesTable.notebookId, notebookId));
    const [deleted] = await db.delete(notebooksTable)
        .where(eq(notebooksTable.id, notebookId))
        .returning();
    return deleted;
}

export async function createNote(content: string, authorId: number, notebookId: number) {
    const [note] = await db.insert(notesTable)
        .values({ content: content.trim(), authorId, notebookId })
        .returning();

    if (!note) {
        throw new Error("Error creating the note");
    }

    return note;
}

export async function getNotes(notebookId: number) {
    const notes = await db.select().from(notesTable)
        .where(eq(notesTable.notebookId, notebookId))
        .leftJoin(usersTable, eq(notesTable.authorId, usersTable.id))
        .orderBy(notesTable.createdAt);

    return notes.map(n => ({
        ...n.notes,
        authorUsername: n.users?.username,
        authorFirstName: n.users?.firstName,
    }));
}

export async function getNote(noteId: number) {
    const [note] = await db.select().from(notesTable)
        .where(eq(notesTable.id, noteId))
        .leftJoin(usersTable, eq(notesTable.authorId, usersTable.id))
        .limit(1);

    if (!note) return null;
    return {
        ...note.notes,
        authorUsername: note.users?.username,
        authorFirstName: note.users?.firstName,
    };
}

export async function updateNote(noteId: number, newContent: string) {
    const [note] = await db.update(notesTable)
        .set({ content: newContent.trim() })
        .where(eq(notesTable.id, noteId))
        .returning();

    if (!note) {
        throw new Error("Error updating the note");
    }

    return note;
}

export async function deleteNote(noteId: number) {
    const [deleted] = await db.delete(notesTable)
        .where(eq(notesTable.id, noteId))
        .returning();
    return deleted;
}
