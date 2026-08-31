import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
  type AnySQLiteColumn,
} from 'drizzle-orm/sqlite-core';

export const workspaces = sqliteTable('workspaces', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  createdAt: text('created_at').notNull(),
});

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  authUserId: text('auth_user_id'),
  email: text('email'),
  name: text('name').notNull(),
  initials: text('initials').notNull(),
  color: text('color').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').notNull(),
}, (table) => [
  uniqueIndex('idx_users_auth_user_id').on(table.authUserId),
  uniqueIndex('idx_users_email').on(table.email),
]);

export const workspaceMembers = sqliteTable('workspace_members', {
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  accessRole: text('access_role').notNull(),
  responsibilityTitle: text('responsibility_title').notNull(),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.workspaceId, table.userId] }),
  check('workspace_members_access_role_check', sql`${table.accessRole} IN ('ADMIN', 'MEMBER')`),
  index('idx_workspace_members_user_id').on(table.userId),
]);

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  key: text('project_key').notNull(),
  name: text('name').notNull(),
  shortName: text('short_name').notNull(),
  color: text('color').notNull(),
  health: text('health').notNull(),
  targetDate: text('target_date'),
  nextTaskNumber: integer('next_task_number').notNull().default(1),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at'),
}, (table) => [
  uniqueIndex('idx_projects_workspace_key').on(table.workspaceId, table.key),
  index('idx_projects_workspace_active').on(table.workspaceId, table.archivedAt),
]);

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  taskNumber: integer('task_number').notNull(),
  key: text('task_key').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  type: text('type').notNull(),
  level: integer('level').notNull().default(0),
  parentId: text('parent_id').references((): AnySQLiteColumn => tasks.id, { onDelete: 'restrict' }),
  ownerId: text('owner_id').notNull().references(() => users.id),
  status: text('status').notNull(),
  priority: text('priority').notNull(),
  progress: integer('progress').notNull().default(0),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  baselineStart: text('baseline_start').notNull(),
  baselineEnd: text('baseline_end').notNull(),
  critical: integer('critical', { mode: 'boolean' }).notNull().default(false),
  locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  version: integer('version').notNull().default(1),
  createdBy: text('created_by').notNull().references(() => users.id),
  updatedBy: text('updated_by').notNull().references(() => users.id),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
  archivedAt: text('archived_at'),
}, (table) => [
  uniqueIndex('idx_tasks_project_key').on(table.projectId, table.key),
  index('idx_tasks_project_active_order').on(table.projectId, table.archivedAt, table.sortOrder),
  index('idx_tasks_project_owner_status').on(table.projectId, table.ownerId, table.status),
  check('tasks_type_check', sql`${table.type} IN ('group', 'task', 'milestone')`),
  check('tasks_status_check', sql`${table.status} IN ('待开始', '进行中', '待评审', '已完成')`),
  check('tasks_priority_check', sql`${table.priority} IN ('最高', '高', '中', '低')`),
  check('tasks_progress_check', sql`${table.progress} BETWEEN 0 AND 100`),
  check('tasks_level_check', sql`${table.level} BETWEEN 0 AND 8`),
]);

export const taskDependencies = sqliteTable('task_dependencies', {
  taskId: text('task_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  predecessorId: text('predecessor_id').notNull().references(() => tasks.id, { onDelete: 'cascade' }),
  relationType: text('relation_type').notNull().default('FS'),
  lagDays: integer('lag_days').notNull().default(0),
  createdAt: text('created_at').notNull(),
}, (table) => [
  primaryKey({ columns: [table.taskId, table.predecessorId] }),
  index('idx_task_dependencies_predecessor').on(table.predecessorId),
  check('task_dependencies_not_self_check', sql`${table.taskId} <> ${table.predecessorId}`),
  check('task_dependencies_relation_check', sql`${table.relationType} = 'FS'`),
]);

export const auditEvents = sqliteTable('audit_events', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workspaceId: text('workspace_id').notNull().references(() => workspaces.id, { onDelete: 'cascade' }),
  projectId: text('project_id').references(() => projects.id, { onDelete: 'cascade' }),
  taskId: text('task_id').references(() => tasks.id, { onDelete: 'set null' }),
  actorId: text('actor_id').notNull().references(() => users.id),
  action: text('action').notNull(),
  summary: text('summary').notNull(),
  changedFieldsJson: text('changed_fields_json'),
  occurredAt: text('occurred_at').notNull(),
}, (table) => [
  index('idx_audit_events_project_time').on(table.projectId, table.occurredAt),
  index('idx_audit_events_task_time').on(table.taskId, table.occurredAt),
]);
