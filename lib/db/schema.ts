import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  boolean,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: varchar('role', { length: 20 }).notNull().default('member'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  deletedAt: timestamp('deleted_at'),
  credits: integer('credits').notNull().default(0),
});

export const teams = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubscriptionId: text('stripe_subscription_id').unique(),
  stripeProductId: text('stripe_product_id'),
  planName: varchar('plan_name', { length: 50 }),
  subscriptionStatus: varchar('subscription_status', { length: 20 }),
  credits: integer('credits').notNull().default(0),
});

export const teamMembers = pgTable('team_members', {
  id: serial('id').primaryKey(),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  role: varchar('role', { length: 50 }).notNull(),
  joinedAt: timestamp('joined_at').notNull().defaultNow(),
});

export const activityLogs = pgTable('activity_logs', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id').references(() => users.id),
  action: text('action').notNull(),
  timestamp: timestamp('timestamp').notNull().defaultNow(),
  ipAddress: varchar('ip_address', { length: 45 }),
});

export const invitations = pgTable('invitations', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  email: varchar('email', { length: 255 }).notNull(),
  role: varchar('role', { length: 50 }).notNull(),
  invitedBy: integer('invited_by')
    .notNull()
    .references(() => users.id),
  invitedAt: timestamp('invited_at').notNull().defaultNow(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
});

// New tables for the interior design visualization platform

export const renderJobs = pgTable('render_jobs', {
  id: uuid('id').primaryKey().defaultRandom(), // Changed from serial to uuid
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  title: varchar('title', { length: 100 }).notNull(),
  roomType: varchar('room_type', { length: 50 }).notNull(),
  lighting: varchar('lighting', { length: 50 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'), // pending, processing, completed, failed
  inputImagePath: text('input_image_path').notNull(), // Renamed from collageImagePath
  resultImagePath: text('result_image_path'),
  prompt: text('prompt'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
  errorMessage: text('error_message'),
  creditDeducted: boolean('credit_deducted').notNull().default(false),
});

export const creditTransactions = pgTable('credit_transactions', {
  id: serial('id').primaryKey(),
  teamId: integer('team_id')
    .notNull()
    .references(() => teams.id),
  userId: integer('user_id')
    .notNull()
    .references(() => users.id),
  amount: integer('amount').notNull(), // positive for purchases, negative for usage
  description: text('description').notNull(),
  balanceAfter: integer('balance_after').notNull(),
  stripePaymentId: text('stripe_payment_id'),
  renderJobId: uuid('render_job_id').references(() => renderJobs.id), // Changed reference type to uuid
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => {
  return {
    stripePaymentIdIdx: unique().on(table.stripePaymentId),
  };
});

// Relations

export const teamsRelations = relations(teams, ({ many }) => ({
  teamMembers: many(teamMembers),
  activityLogs: many(activityLogs),
  invitations: many(invitations),
  renderJobs: many(renderJobs),
  creditTransactions: many(creditTransactions),
}));

export const usersRelations = relations(users, ({ many }) => ({
  teamMembers: many(teamMembers),
  invitationsSent: many(invitations),
  renderJobs: many(renderJobs),
  creditTransactions: many(creditTransactions),
}));

export const invitationsRelations = relations(invitations, ({ one }) => ({
  team: one(teams, {
    fields: [invitations.teamId],
    references: [teams.id],
  }),
  invitedBy: one(users, {
    fields: [invitations.invitedBy],
    references: [users.id],
  }),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
  team: one(teams, {
    fields: [activityLogs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [activityLogs.userId],
    references: [users.id],
  }),
}));

export const renderJobsRelations = relations(renderJobs, ({ one, many }) => ({
  team: one(teams, {
    fields: [renderJobs.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [renderJobs.userId],
    references: [users.id],
  }),
  creditTransactions: many(creditTransactions),
}));

export const creditTransactionsRelations = relations(creditTransactions, ({ one }) => ({
  team: one(teams, {
    fields: [creditTransactions.teamId],
    references: [teams.id],
  }),
  user: one(users, {
    fields: [creditTransactions.userId],
    references: [users.id],
  }),
  renderJob: one(renderJobs, {
    fields: [creditTransactions.renderJobId],
    references: [renderJobs.id],
  }),
}));

// Types

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type NewTeamMember = typeof teamMembers.$inferInsert;
export type ActivityLog = typeof activityLogs.$inferSelect;
export type NewActivityLog = typeof activityLogs.$inferInsert;
export type Invitation = typeof invitations.$inferSelect;
export type NewInvitation = typeof invitations.$inferInsert;
export type RenderJob = typeof renderJobs.$inferSelect;
export type NewRenderJob = typeof renderJobs.$inferInsert;
export type CreditTransaction = typeof creditTransactions.$inferSelect;
export type NewCreditTransaction = typeof creditTransactions.$inferInsert;

export type TeamDataWithMembers = Team & {
  teamMembers: (TeamMember & {
    user: Pick<User, 'id' | 'name' | 'email'>;
  })[];
};

export enum ActivityType {
  SIGN_UP = 'SIGN_UP',
  SIGN_IN = 'SIGN_IN',
  SIGN_OUT = 'SIGN_OUT',
  UPDATE_PASSWORD = 'UPDATE_PASSWORD',
  DELETE_ACCOUNT = 'DELETE_ACCOUNT',
  UPDATE_ACCOUNT = 'UPDATE_ACCOUNT',
  CREATE_TEAM = 'CREATE_TEAM',
  REMOVE_TEAM_MEMBER = 'REMOVE_TEAM_MEMBER',
  INVITE_TEAM_MEMBER = 'INVITE_TEAM_MEMBER',
  ACCEPT_INVITATION = 'ACCEPT_INVITATION',
  PURCHASE_CREDITS = 'PURCHASE_CREDITS',
  CREATE_RENDER = 'CREATE_RENDER',
  COMPLETE_RENDER = 'COMPLETE_RENDER',
}

export enum RenderStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}
