import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { patients } from './patients'

// LGPD: Art. 5º, XI — pseudonimização — mapeamento entre token e identidade real
// Acesso restrito ao controlador (admin/DPO) — nunca exposto em logs ou respostas de API
export const patientTokens = pgTable(
  'patient_tokens',
  {
    // LGPD: Art. 6º, VII — segurança — identificador técnico sem exposição de dado pessoal
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 5º, XI — referência ao titular real (acesso restrito por RLS)
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    // LGPD: Art. 5º, XI — token pseudonimizado usado em audit_logs no lugar do patientId
    token: text('token').notNull().unique(),
    // LGPD: Art. 6º, X — responsabilização — registro da criação do token
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  () => [
    // LGPD: Art. 5º, XI — acesso ao mapeamento restrito ao controlador (admin/DPO)
    pgPolicy('patient_tokens_admin_only', {
      using: sql`current_setting('app.current_role', true) = 'admin'`,
    }),
  ],
)

export type PatientToken = typeof patientTokens.$inferSelect
export type NewPatientToken = typeof patientTokens.$inferInsert
