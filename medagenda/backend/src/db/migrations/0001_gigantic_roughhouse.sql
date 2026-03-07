ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "users_admin_all" ON "users" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) = 'admin');--> statement-breakpoint
CREATE POLICY "users_self" ON "users" AS PERMISSIVE FOR ALL TO public USING (
        current_setting('app.current_role', true) IN ('doctor', 'receptionist', 'patient')
        AND "users"."id"::text = current_setting('app.current_user_id', true)
      );--> statement-breakpoint
CREATE POLICY "audit_logs_admin_all" ON "audit_logs" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) = 'admin');--> statement-breakpoint
CREATE POLICY "audit_logs_self" ON "audit_logs" AS PERMISSIVE FOR ALL TO public USING (
        current_setting('app.current_role', true) IN ('doctor', 'receptionist', 'patient')
        AND "audit_logs"."user_id"::text = current_setting('app.current_user_id', true)
      );