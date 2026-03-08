import { sql } from 'drizzle-orm'
import {
  integer,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { incidentSeverityEnum, incidentStatusEnum } from './enums'
import { users } from './users'

// LGPD: Art. 48 — obrigação de comunicar incidentes de segurança à ANPD e aos titulares afetados
// Resolução CD/ANPD nº 15/2024 — prazo de 72h a partir da detecção para notificação preliminar
export const incidents = pgTable(
  'incidents',
  {
    // LGPD: Art. 6º, VII — identificador sem exposição de dados pessoais
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 48, §1º — descrição do tipo de dado afetado e medidas adotadas
    title: text('title').notNull(),
    // LGPD: Art. 48, §1º — narrativa do incidente: o que ocorreu, dados envolvidos
    description: text('description'),
    // LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — classificação de risco do incidente
    severity: incidentSeverityEnum('severity').notNull().default('medium'),
    // LGPD: Art. 48 — ciclo de vida: open → notified → resolved
    status: incidentStatusEnum('status').notNull().default('open'),
    // LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — marco zero do prazo de 72h
    detectedAt: timestamp('detected_at').notNull(),
    // LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — prova do cumprimento do prazo de 72h
    notifiedAnpdAt: timestamp('notified_anpd_at'),
    // LGPD: Art. 48, §1º, I — estimativa de titulares afetados
    affectedCount: integer('affected_count'),
    // LGPD: Art. 48, §1º, II — categorias de dados afetados (tabelas/recursos)
    affectedResources: text('affected_resources').array(),
    // LGPD: Art. 48, §1º, III — medidas de contenção adotadas pelo controlador
    containmentMeasures: text('containment_measures'),
    // LGPD: Art. 6º, X — responsabilização — identificação do responsável pelo reporte
    reportedBy: uuid('reported_by')
      .notNull()
      .references(() => users.id),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade temporal do registro
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade de alterações no incidente
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  () => [
    // LGPD: Art. 48 — apenas DPO/admin pode registrar e visualizar incidentes
    pgPolicy('incidents_admin_only', {
      using: sql`current_setting('app.current_role', true) = 'admin'`,
    }),
  ],
)

export type Incident = typeof incidents.$inferSelect
export type NewIncident = typeof incidents.$inferInsert
