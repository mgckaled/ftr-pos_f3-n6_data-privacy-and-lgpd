import { sql } from 'drizzle-orm'
import { boolean, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { consentPurposeEnum } from './enums'
import { patients } from './patients'

// LGPD: Art. 8º, §2º — prova de consentimento: campos grantedAt, ipAddress, policyVersion
// Imutável por finalidade: revogar gera novo registro (revokedAt), nunca edita o original
export const consents = pgTable(
  'consents',
  {
    // LGPD: Art. 6º, VII — segurança — identificador único sem exposição de dado pessoal
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 8º — vincula o consentimento ao titular dos dados
    patientId: uuid('patient_id').notNull().references(() => patients.id),
    // LGPD: Art. 8º — consentimento específico por finalidade (nunca genérico)
    purpose: consentPurposeEnum('purpose').notNull(),
    // LGPD: Art. 8º — manifestação livre, inequívoca e informada do titular
    granted: boolean('granted').notNull(),
    // LGPD: Art. 8º, §2º — prova temporal do consentimento (ônus do controlador)
    grantedAt: timestamp('granted_at').notNull().defaultNow(),
    // LGPD: Art. 8º, §5º — revogação a qualquer momento, a pedido do titular
    revokedAt: timestamp('revoked_at'),
    // LGPD: Art. 8º, §2º — endereço IP como prova do consentimento
    ipAddress: text('ip_address'),
    // LGPD: Art. 8º, §2º — versão da política vigente no momento do consentimento
    policyVersion: text('policy_version').notNull(),
  },
  (t) => [
    // LGPD: Art. 6º, X — responsabilização — admin e recepcionista gerenciam consentimentos
    pgPolicy('consents_admin_receptionist', {
      using: sql`current_setting('app.current_role', true) IN ('admin', 'receptionist')`,
    }),
    // LGPD: Art. 6º, III — titular acessa apenas os próprios consentimentos via join com patients
    pgPolicy('consents_patient_self', {
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
  ],
)

export type Consent = typeof consents.$inferSelect
export type NewConsent = typeof consents.$inferInsert
