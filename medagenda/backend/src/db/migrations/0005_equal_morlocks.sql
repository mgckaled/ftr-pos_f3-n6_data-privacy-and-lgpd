-- LGPD: Art. 18 — fila de direitos do titular com SLA de 15 dias corridos
-- Fase 5: tabela data_requests + enums data_request_type e data_request_status
-- Nota: incidents e seus enums já existem (migration 0004_phase4_incidents.sql)
CREATE TYPE "public"."data_request_status" AS ENUM('pending', 'in_progress', 'completed', 'denied', 'expired');--> statement-breakpoint
CREATE TYPE "public"."data_request_type" AS ENUM('access', 'correction', 'deletion', 'portability', 'anonymization', 'revoke_consent', 'information', 'automated_decision_review');--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"type" "data_request_type" NOT NULL,
	"status" "data_request_status" DEFAULT 'pending' NOT NULL,
	"reason" text,
	"response" text,
	"processed_by" uuid,
	"deadline_at" timestamp NOT NULL,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"resolved_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "data_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "data_requests" ADD CONSTRAINT "data_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- LGPD: Art. 18 — admin/DPO gerencia todas as solicitações
CREATE POLICY "data_requests_admin_all" ON "data_requests" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) = 'admin');--> statement-breakpoint
-- LGPD: Art. 18 — titular seleciona apenas as próprias solicitações (via join patients.user_id)
CREATE POLICY "data_requests_patient_self" ON "data_requests" AS PERMISSIVE FOR SELECT TO public USING (
        current_setting('app.current_role', true) = 'patient'
        AND EXISTS (
          SELECT 1 FROM patients
          WHERE patients.id = "data_requests"."patient_id"
          AND patients.user_id::text = current_setting('app.current_user_id', true)
        )
      );--> statement-breakpoint
-- LGPD: Art. 18 — titular cria apenas solicitações vinculadas ao próprio patientId (WITH CHECK para INSERT)
CREATE POLICY "data_requests_patient_insert" ON "data_requests" AS PERMISSIVE FOR INSERT TO public WITH CHECK (
        current_setting('app.current_role', true) = 'patient'
        AND EXISTS (
          SELECT 1 FROM patients
          WHERE patients.id = "data_requests"."patient_id"
          AND patients.user_id::text = current_setting('app.current_user_id', true)
        )
      );
