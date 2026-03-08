import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { dataRequestStatusEnum, dataRequestTypeEnum } from './enums'
import { patients } from './patients'
import { users } from './users'

// LGPD: Art. 18 — fila de direitos do titular: acesso, correção, eliminação, portabilidade,
// anonimização, revogação de consentimento, informação e revisão de decisão automatizada.
// SLA de 15 dias corridos (Art. 18, §5º)
export const dataRequests = pgTable(
  'data_requests',
  {
    // LGPD: Art. 6º, VII — identificador único sem exposição de dado pessoal direto
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 18 — vincula a solicitação ao titular dos dados
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    // LGPD: Art. 18 — tipo da solicitação determina o fluxo de atendimento pelo controlador
    type: dataRequestTypeEnum('type').notNull(),
    // LGPD: Art. 18 — ciclo de vida: pending → in_progress → completed | denied | expired
    status: dataRequestStatusEnum('status').notNull().default('pending'),
    // LGPD: Art. 18 — descrição livre do titular sobre a motivação da solicitação
    reason: text('reason'),
    // LGPD: Art. 18, §3º — resposta formal do controlador ao titular
    response: text('response'),
    // LGPD: Art. 6º, X — responsabilização — agente interno que processou a solicitação
    processedBy: uuid('processed_by').references(() => users.id),
    // LGPD: Art. 18, §5º — SLA: deadline calculado como requestedAt + 15 dias corridos
    deadlineAt: timestamp('deadline_at').notNull(),
    // LGPD: Art. 6º, X — responsabilização — timestamp imutável de abertura da solicitação
    requestedAt: timestamp('requested_at').notNull().defaultNow(),
    // LGPD: Art. 6º, X — rastreabilidade — timestamp de conclusão ou negação
    resolvedAt: timestamp('resolved_at'),
  },
  (t) => [
    // LGPD: Art. 18 — admin/DPO gerencia todas as solicitações (operações ALL)
    pgPolicy('data_requests_admin_all', {
      using: sql`current_setting('app.current_role', true) = 'admin'`,
    }),
    // LGPD: Art. 18 — titular seleciona apenas as próprias solicitações
    // Join necessário: patient.user_id = current_user_id (patient não tem acesso direto ao patientId)
    pgPolicy('data_requests_patient_self', {
      for: 'select',
      using: sql`
        current_setting('app.current_role', true) = 'patient'
        AND EXISTS (
          SELECT 1 FROM patients
          WHERE patients.id = ${t.patientId}
          AND patients.user_id::text = current_setting('app.current_user_id', true)
        )
      `,
    }),
    // LGPD: Art. 18 — titular cria apenas solicitações vinculadas ao próprio patientId
    // withCheck (não using) é obrigatório para policies de INSERT
    pgPolicy('data_requests_patient_insert', {
      for: 'insert',
      withCheck: sql`
        current_setting('app.current_role', true) = 'patient'
        AND EXISTS (
          SELECT 1 FROM patients
          WHERE patients.id = ${t.patientId}
          AND patients.user_id::text = current_setting('app.current_user_id', true)
        )
      `,
    }),
  ],
)

export type DataRequest = typeof dataRequests.$inferSelect
export type NewDataRequest = typeof dataRequests.$inferInsert
