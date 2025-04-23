import { desc, and, eq, isNull, count, gte } from 'drizzle-orm';
import { db } from './drizzle';
import { activityLogs, teamMembers, teams, users, renderJobs, ActivityType, RenderStatus } from './schema';
import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth/session';

export async function getUser() {
  const sessionCookie = (await cookies()).get('session');
  if (!sessionCookie || !sessionCookie.value) {
    return null;
  }

  const sessionData = await verifyToken(sessionCookie.value);
  if (
    !sessionData ||
    !sessionData.user ||
    typeof sessionData.user.id !== 'number'
  ) {
    return null;
  }

  if (new Date(sessionData.expires) < new Date()) {
    return null;
  }

  const user = await db
    .select()
    .from(users)
    .where(and(eq(users.id, sessionData.user.id), isNull(users.deletedAt)))
    .limit(1);

  if (user.length === 0) {
    return null;
  }

  return user[0];
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: number,
  subscriptionData: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    planName: string | null;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...subscriptionData,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function getUserWithTeam(userId: number) {
  const result = await db
    .select({
      user: users,
      teamId: teamMembers.teamId,
    })
    .from(users)
    .leftJoin(teamMembers, eq(users.id, teamMembers.userId))
    .where(eq(users.id, userId))
    .limit(1);

  return result[0];
}

export async function getActivityLogs() {
  const user = await getUser();
  if (!user) {
    throw new Error('User not authenticated');
  }

  return await db
    .select({
      id: activityLogs.id,
      action: activityLogs.action,
      timestamp: activityLogs.timestamp,
      ipAddress: activityLogs.ipAddress,
      userName: users.name,
    })
    .from(activityLogs)
    .leftJoin(users, eq(activityLogs.userId, users.id))
    .where(eq(activityLogs.userId, user.id))
    .orderBy(desc(activityLogs.timestamp))
    .limit(10);
}

export async function getTeamForUser(userId: number) {
  const result = await db.query.users.findFirst({
    where: eq(users.id, userId),
    with: {
      teamMembers: {
        with: {
          team: {
            with: {
              teamMembers: {
                with: {
                  user: {
                    columns: {
                      id: true,
                      name: true,
                      email: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  return result?.teamMembers[0]?.team || null;
}

export async function logActivity({
  teamId,
  userId,
  action,
  ipAddress,
}: {
  teamId: number;
  userId: number;
  action: ActivityType | string;
  ipAddress: string;
}) {
  return await db.insert(activityLogs).values({
    teamId,
    userId,
    action,
    ipAddress,
    timestamp: new Date(),
  });
}

export async function getRecentRendersForTeam(teamId: number, limit: number = 3) {
  return await db
    .select({
      id: renderJobs.id,
      title: renderJobs.title,
      resultImagePath: renderJobs.resultImagePath,
      createdAt: renderJobs.createdAt,
    })
    .from(renderJobs)
    .where(and(eq(renderJobs.teamId, teamId), eq(renderJobs.status, RenderStatus.COMPLETED)))
    .orderBy(desc(renderJobs.createdAt))
    .limit(limit);
}

export async function getTotalRendersForTeam(teamId: number) {
  const result = await db
    .select({ value: count() })
    .from(renderJobs)
    .where(and(eq(renderJobs.teamId, teamId), eq(renderJobs.status, RenderStatus.COMPLETED)));

  return result[0]?.value ?? 0;
}

export async function getRecentRendersCountForTeam(teamId: number, days: number = 7) {
  const dateThreshold = new Date();
  dateThreshold.setDate(dateThreshold.getDate() - days);

  const result = await db
    .select({ value: count() })
    .from(renderJobs)
    .where(and(
      eq(renderJobs.teamId, teamId),
      eq(renderJobs.status, RenderStatus.COMPLETED),
      gte(renderJobs.createdAt, dateThreshold)
    ));

  return result[0]?.value ?? 0;
}
