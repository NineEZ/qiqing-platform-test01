CREATE TABLE `audit_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text,
	`task_id` text,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`summary` text NOT NULL,
	`changed_fields_json` text,
	`occurred_at` text NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_events_project_time` ON `audit_events` (`project_id`,`occurred_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_events_task_time` ON `audit_events` (`task_id`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_key` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`color` text NOT NULL,
	`health` text NOT NULL,
	`target_date` text,
	`next_task_number` integer DEFAULT 1 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_projects_workspace_key` ON `projects` (`workspace_id`,`project_key`);--> statement-breakpoint
CREATE INDEX `idx_projects_workspace_active` ON `projects` (`workspace_id`,`archived_at`);--> statement-breakpoint
CREATE TABLE `task_dependencies` (
	`task_id` text NOT NULL,
	`predecessor_id` text NOT NULL,
	`relation_type` text DEFAULT 'FS' NOT NULL,
	`lag_days` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`task_id`, `predecessor_id`),
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`predecessor_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "task_dependencies_not_self_check" CHECK("task_dependencies"."task_id" <> "task_dependencies"."predecessor_id"),
	CONSTRAINT "task_dependencies_relation_check" CHECK("task_dependencies"."relation_type" = 'FS')
);
--> statement-breakpoint
CREATE INDEX `idx_task_dependencies_predecessor` ON `task_dependencies` (`predecessor_id`);--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`task_number` integer NOT NULL,
	`task_key` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`type` text NOT NULL,
	`level` integer DEFAULT 0 NOT NULL,
	`parent_id` text,
	`owner_id` text NOT NULL,
	`status` text NOT NULL,
	`priority` text NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`baseline_start` text NOT NULL,
	`baseline_end` text NOT NULL,
	`critical` integer DEFAULT false NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`created_by` text NOT NULL,
	`updated_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`archived_at` text,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`parent_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE restrict,
	FOREIGN KEY (`owner_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "tasks_type_check" CHECK("tasks"."type" IN ('group', 'task', 'milestone')),
	CONSTRAINT "tasks_status_check" CHECK("tasks"."status" IN ('待开始', '进行中', '待评审', '已完成')),
	CONSTRAINT "tasks_priority_check" CHECK("tasks"."priority" IN ('最高', '高', '中', '低')),
	CONSTRAINT "tasks_progress_check" CHECK("tasks"."progress" BETWEEN 0 AND 100),
	CONSTRAINT "tasks_level_check" CHECK("tasks"."level" BETWEEN 0 AND 8)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_tasks_project_key` ON `tasks` (`project_id`,`task_key`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_active_order` ON `tasks` (`project_id`,`archived_at`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_tasks_project_owner_status` ON `tasks` (`project_id`,`owner_id`,`status`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`auth_user_id` text,
	`email` text,
	`name` text NOT NULL,
	`initials` text NOT NULL,
	`color` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_auth_user_id` ON `users` (`auth_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE TABLE `workspace_members` (
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_role` text NOT NULL,
	`responsibility_title` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`workspace_id`, `user_id`),
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "workspace_members_access_role_check" CHECK("workspace_members"."access_role" IN ('ADMIN', 'MEMBER'))
);
--> statement-breakpoint
CREATE INDEX `idx_workspace_members_user_id` ON `workspace_members` (`user_id`);--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
