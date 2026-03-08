CREATE TYPE "public"."appointment_status" AS ENUM('scheduled', 'completed', 'cancelled', 'no_show');--> statement-breakpoint
CREATE TYPE "public"."sensitive_legal_basis" AS ENUM('health_care', 'vital_interest', 'research_anonymized', 'legal_obligation');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"scheduled_at" timestamp NOT NULL,
	"status" "appointment_status" DEFAULT 'scheduled' NOT NULL,
	"notes" text,
	"retention_expires_at" timestamp NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "appointments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "private"."medical_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"appointment_id" uuid NOT NULL,
	"patient_id" uuid NOT NULL,
	"doctor_id" uuid NOT NULL,
	"diagnosis" text,
	"prescription" text,
	"clinical_notes" text,
	"icd_code" text,
	"sensitive_legal_basis" "sensitive_legal_basis" DEFAULT 'health_care' NOT NULL,
	"retention_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "medical_records_appointment_id_unique" UNIQUE("appointment_id")
);
--> statement-breakpoint
ALTER TABLE "private"."medical_records" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."medical_records" ADD CONSTRAINT "medical_records_appointment_id_appointments_id_fk" FOREIGN KEY ("appointment_id") REFERENCES "public"."appointments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."medical_records" ADD CONSTRAINT "medical_records_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "private"."medical_records" ADD CONSTRAINT "medical_records_doctor_id_users_id_fk" FOREIGN KEY ("doctor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE MATERIALIZED VIEW "public"."appointment_stats" AS (select date_trunc('month', "scheduled_at") as "month", count(*)::int as "total", count(*) filter (where "status" = 'completed')::int as "completed", count(*) filter (where "status" = 'cancelled')::int as "cancelled", count(*) filter (where "status" = 'no_show')::int as "no_show" from "appointments" where "appointments"."deleted_at" is null group by date_trunc('month', "appointments"."scheduled_at"));--> statement-breakpoint
CREATE POLICY "appointments_admin_receptionist" ON "appointments" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) IN ('admin', 'receptionist'));--> statement-breakpoint
CREATE POLICY "appointments_doctor_own" ON "appointments" AS PERMISSIVE FOR SELECT TO public USING (
        current_setting('app.current_role', true) = 'doctor'
        AND "appointments"."doctor_id"::text = current_setting('app.current_user_id', true)
      );--> statement-breakpoint
CREATE POLICY "medical_records_doctor_own" ON "private"."medical_records" AS PERMISSIVE FOR ALL TO public USING (
        current_setting('app.current_role', true) = 'doctor'
        AND "private"."medical_records"."doctor_id"::text = current_setting('app.current_user_id', true)
      );--> statement-breakpoint
CREATE POLICY "medical_records_admin_read" ON "private"."medical_records" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.current_role', true) = 'admin');