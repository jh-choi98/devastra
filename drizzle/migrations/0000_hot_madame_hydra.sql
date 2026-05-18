CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"repo_id" uuid NOT NULL,
	"source" text DEFAULT 'github' NOT NULL,
	"external_id" text NOT NULL,
	"type" text NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "activity_territories" (
	"activity_id" uuid NOT NULL,
	"territory_type" text NOT NULL,
	"weight" numeric NOT NULL,
	CONSTRAINT "activity_territories_activity_id_territory_type_pk" PRIMARY KEY("activity_id","territory_type")
);
--> statement-breakpoint
CREATE TABLE "email_sends" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"email_type" text NOT NULL,
	"related_id" uuid,
	"external_message_id" text,
	"bounced" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY NOT NULL,
	"github_id" bigint NOT NULL,
	"github_login" text NOT NULL,
	"display_username" text NOT NULL,
	"email" text NOT NULL,
	"avatar_url" text,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_public" boolean DEFAULT false NOT NULL,
	"email_recap_enabled" boolean DEFAULT true NOT NULL,
	"github_access_token_enc" "bytea",
	"github_refresh_token_enc" "bytea",
	"github_token_expires_at" timestamp with time zone,
	"last_event_id" text,
	"last_incremental_sync_at" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_github_id_unique" UNIQUE("github_id"),
	CONSTRAINT "users_display_username_unique" UNIQUE("display_username")
);
--> statement-breakpoint
CREATE TABLE "repositories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text DEFAULT 'github' NOT NULL,
	"external_repo_id" text NOT NULL,
	"owner" text NOT NULL,
	"name" text NOT NULL,
	"primary_language" text,
	"is_included" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "territories" (
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"total_weight" numeric DEFAULT '0' NOT NULL,
	"stage" integer DEFAULT 1 NOT NULL,
	"stage_changed_at" timestamp with time zone,
	"last_grown_at" timestamp with time zone,
	"growth_30d" numeric DEFAULT '0' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "territories_user_id_type_pk" PRIMARY KEY("user_id","type")
);
--> statement-breakpoint
CREATE TABLE "landmarks" (
	"user_id" uuid NOT NULL,
	"tech_key" text NOT NULL,
	"territory_type" text NOT NULL,
	"weight" numeric DEFAULT '0' NOT NULL,
	"first_unlocked_at" timestamp with time zone,
	"last_grown_at" timestamp with time zone,
	CONSTRAINT "landmarks_user_id_tech_key_pk" PRIMARY KEY("user_id","tech_key")
);
--> statement-breakpoint
CREATE TABLE "sync_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"progress" jsonb,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_recaps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"week_start" date NOT NULL,
	"highlights" jsonb NOT NULL,
	"og_image_url" text,
	"email_sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_repo_id_repositories_id_fk" FOREIGN KEY ("repo_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "activity_territories" ADD CONSTRAINT "activity_territories_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_sends" ADD CONSTRAINT "email_sends_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "territories" ADD CONSTRAINT "territories_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "landmarks" ADD CONSTRAINT "landmarks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sync_jobs" ADD CONSTRAINT "sync_jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "weekly_recaps" ADD CONSTRAINT "weekly_recaps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "activities_user_source_external_id_idx" ON "activities" USING btree ("user_id","source","external_id");--> statement-breakpoint
CREATE INDEX "activities_user_occurred_at_idx" ON "activities" USING btree ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "activities_repo_occurred_at_idx" ON "activities" USING btree ("repo_id","occurred_at");--> statement-breakpoint
CREATE INDEX "email_sends_user_sent_at_idx" ON "email_sends" USING btree ("user_id","sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "repositories_user_source_external_id_idx" ON "repositories" USING btree ("user_id","source","external_repo_id");--> statement-breakpoint
CREATE INDEX "repositories_user_is_included_idx" ON "repositories" USING btree ("user_id","is_included");--> statement-breakpoint
CREATE INDEX "landmarks_user_territory_type_idx" ON "landmarks" USING btree ("user_id","territory_type");--> statement-breakpoint
CREATE INDEX "sync_jobs_user_started_at_idx" ON "sync_jobs" USING btree ("user_id","started_at");--> statement-breakpoint
CREATE UNIQUE INDEX "weekly_recaps_user_week_start_idx" ON "weekly_recaps" USING btree ("user_id","week_start");