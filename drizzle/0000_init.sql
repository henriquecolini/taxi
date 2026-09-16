CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_id_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `gitlab_commits` (
	`id` text PRIMARY KEY NOT NULL,
	`repository_id` text NOT NULL,
	`sha` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`author_name` text NOT NULL,
	`author_email` text NOT NULL,
	`authored_at` integer NOT NULL,
	`web_url` text NOT NULL,
	`additions` integer DEFAULT 0 NOT NULL,
	`deletions` integer DEFAULT 0 NOT NULL,
	`branches` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`repository_id`) REFERENCES `project_repositories`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gitlab_commits_repository_sha_idx` ON `gitlab_commits` (`repository_id`,`sha`);--> statement-breakpoint
CREATE INDEX `gitlab_commits_repository_authored_idx` ON `gitlab_commits` (`repository_id`,`authored_at`);--> statement-breakpoint
CREATE TABLE `intervals` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`rate` integer NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `intervals_project_started_idx` ON `intervals` (`project_id`,`started_at`);--> statement-breakpoint
CREATE INDEX `intervals_started_idx` ON `intervals` (`started_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `intervals_single_running_idx` ON `intervals` (("ended_at" IS NULL)) WHERE "intervals"."ended_at" IS NULL;--> statement-breakpoint
CREATE TABLE `invoice_items` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`description` text NOT NULL,
	`amount` integer NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `invoice_items_invoice_idx` ON `invoice_items` (`invoice_id`);--> statement-breakpoint
CREATE TABLE `invoice_summaries` (
	`id` text PRIMARY KEY NOT NULL,
	`invoice_id` text NOT NULL,
	`scope` text NOT NULL,
	`headline` text DEFAULT '' NOT NULL,
	`content` text NOT NULL,
	`model` text DEFAULT '' NOT NULL,
	`generated_at` integer NOT NULL,
	FOREIGN KEY (`invoice_id`) REFERENCES `invoices`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoice_summaries_invoice_scope_idx` ON `invoice_summaries` (`invoice_id`,`scope`);--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`date` text NOT NULL,
	`name` text NOT NULL,
	`duration_ms` integer NOT NULL,
	`subtotal` integer NOT NULL,
	`extras_total` integer NOT NULL,
	`total` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `invoices_project_date_idx` ON `invoices` (`project_id`,`date`);--> statement-breakpoint
CREATE TABLE `project_members` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`email` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_members_project_email_idx` ON `project_members` (`project_id`,`email`);--> statement-breakpoint
CREATE INDEX `project_members_email_idx` ON `project_members` (`email`);--> statement-breakpoint
CREATE TABLE `project_repositories` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`path` text NOT NULL,
	`gitlab_project_id` integer,
	`web_url` text,
	`last_synced_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_repositories_project_path_idx` ON `project_repositories` (`project_id`,`path`);--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`client_name` text DEFAULT '' NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`logo` blob,
	`logo_mime` text,
	`currency` text DEFAULT 'BRL' NOT NULL,
	`hourly_rate` integer DEFAULT 0 NOT NULL,
	`ai_enabled` integer DEFAULT false NOT NULL,
	`ai_locale` text DEFAULT 'en' NOT NULL,
	`archived_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_id_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);