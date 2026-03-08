-- LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024
-- Tabela de incidentes de segurança com rastreamento do prazo de 72h para notificação à ANPD

CREATE TYPE "public"."incident_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('open', 'notified', 'resolved');--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "incident_severity" DEFAULT 'medium' NOT NULL,
	"status" "incident_status" DEFAULT 'open' NOT NULL,
	"detected_at" timestamp NOT NULL,
	"notified_anpd_at" timestamp,
	"affected_count" integer,
	"affected_resources" text[],
	"containment_measures" text,
	"reported_by" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "incidents" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
-- LGPD: Art. 48 — acesso exclusivo ao DPO/admin; nenhum outro role pode visualizar ou registrar incidentes
CREATE POLICY "incidents_admin_only" ON "incidents" AS PERMISSIVE FOR ALL TO public USING (current_setting('app.current_role', true) = 'admin');
