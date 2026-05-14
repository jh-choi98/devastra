CREATE TABLE "username_history" (
	"old_username" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "misclassification_feedback" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"tech_key" text NOT NULL,
	"territory_type" text NOT NULL,
	"related_repo_id" uuid,
	"category" text NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_global_stats" (
	"tech_key" text PRIMARY KEY NOT NULL,
	"lit_user_count" integer DEFAULT 0 NOT NULL,
	"eligible_user_count" integer DEFAULT 0 NOT NULL,
	"lit_percentage" numeric DEFAULT '0' NOT NULL,
	"computed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "system_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cluster_click_hint_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "share_hint_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recap_diff_hint_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_star_cinematic_seen" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "first_star_cinematic_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "username_history" ADD CONSTRAINT "username_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misclassification_feedback" ADD CONSTRAINT "misclassification_feedback_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "misclassification_feedback" ADD CONSTRAINT "misclassification_feedback_related_repo_id_repositories_id_fk" FOREIGN KEY ("related_repo_id") REFERENCES "public"."repositories"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "misclassification_feedback_user_created_idx" ON "misclassification_feedback" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX "misclassification_feedback_tech_created_idx" ON "misclassification_feedback" USING btree ("tech_key","created_at");

-- ── RLS policies for new pivot tables ───────────────────────────────────────

-- username_history (ADR-30) — public SELECT for redirect resolution; writes service-role
ALTER TABLE public.username_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "username_history_select" ON public.username_history
  FOR SELECT TO anon, authenticated USING (true);
-- INSERT/UPDATE/DELETE intentionally not granted to authenticated; service role bypasses RLS.

-- misclassification_feedback (ADR-40) — INSERT self; SELECT denied to all (service role only)
ALTER TABLE public.misclassification_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "misclassification_feedback_insert" ON public.misclassification_feedback
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
-- No SELECT/UPDATE/DELETE policy — service role handles reads.

-- tech_global_stats (ADR-28) — public SELECT; writes service-role
ALTER TABLE public.tech_global_stats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tech_global_stats_select" ON public.tech_global_stats
  FOR SELECT TO anon, authenticated USING (true);

-- system_messages (ADR-42) — public SELECT; writes service-role (founder via Supabase dashboard SQL)
ALTER TABLE public.system_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_messages_select" ON public.system_messages
  FOR SELECT TO anon, authenticated USING (true);