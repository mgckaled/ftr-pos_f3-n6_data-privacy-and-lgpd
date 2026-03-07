CREATE TYPE "public"."consent_purpose" AS ENUM('medical_treatment', 'data_sharing_partners', 'research', 'insurance', 'marketing');--> statement-breakpoint
CREATE TYPE "public"."legal_basis" AS ENUM('consent', 'legal_obligation', 'contract', 'legitimate_interest', 'vital_interest', 'health_care', 'research');--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"name" text NOT NULL,
	"email" text,
	"phone" text,
	"birth_date" date,
	"cpf" text NOT NULL,
	"legal_basis" "legal_basis" DEFAULT 'consent' NOT NULL,
	"retention_expires_at" timestamp,
	"anonymized_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "patients" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "patient_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "patient_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
ALTER TABLE "patient_tokens" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"purpose" "consent_purpose" NOT NULL,
	"granted" boolean NOT NULL,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	"ip_address" text,
	"policy_version" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "consents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "audit_logs" ALTER COLUMN "legal_basis" SET DATA TYPE "public"."legal_basis" USING "legal_basis"::"public"."legal_basis";--> statement-breakpoint
ALTER TABLE "patients" ADD CONSTRAINT "patients_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "patient_tokens" ADD CONSTRAINT "patient_tokens_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "consents" ADD CONSTRAINT "consents_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "patients_admin_receptionist" ON "patients" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) IN ('admin', 'receptionist'));--> statement-breakpoint
CREATE POLICY "patients_doctor_read" ON "patients" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.current_role', true) = 'doctor');--> statement-breakpoint
CREATE POLICY "patients_self" ON "patients" AS PERMISSIVE FOR ALL TO public USING (
        current_setting('app.current_role', true) = 'patient'
        AND "patients"."user_id"::text = current_setting('app.current_user_id', true)
      );--> statement-breakpoint
CREATE POLICY "patient_tokens_admin_only" ON "patient_tokens" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) = 'admin');--> statement-breakpoint
CREATE POLICY "consents_admin_receptionist" ON "consents" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) IN ('admin', 'receptionist'));--> statement-breakpoint
CREATE POLICY "consents_patient_self" ON "consents" AS PERMISSIVE FOR SELECT TO public USING (
        current_setting('app.current_role', true) = 'patient'
        AND EXISTS (
          SELECT 1 FROM patients
          WHERE patients.id = "consents"."patient_id"
          AND patients.user_id::text = current_setting('app.current_user_id', true)
        )
      );