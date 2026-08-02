import { eq, and, desc } from "drizzle-orm";
import { db } from "./index";
import { usersTable, groupsTable, groupMembersTable, logsTable } from "./schema";

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
        createdAt: logsTable.createdAt
    })
        .from(logsTable)
        .where(and(
            eq(logsTable.groupId, group.id)
        ))
        .orderBy(desc(logsTable.createdAt))
        .limit(limitCount);

    return recentLogs;
}
