import { sql } from 'drizzle-orm'
import {
  date,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { legalBasisEnum } from './enums'
import { users } from './users'

// LGPD: Art. 5º, I — titular dos dados pessoais; Art. 6º, III — princípio da necessidade
export const patients = pgTable(
  'patients',
  {
    // LGPD: Art. 6º, VII — segurança — identificador único sem exposição de dado pessoal
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 6º, III — necessidade — vincula conta de usuário apenas quando o titular solicita acesso
    userId: uuid('user_id').references(() => users.id),
    // LGPD: dado pessoal — Art. 5º, I
    name: text('name').notNull(),
    // LGPD: dado pessoal — Art. 5º, I
    email: text('email'),
    // LGPD: dado pessoal — Art. 5º, I
    phone: text('phone'),
    // LGPD: dado pessoal — Art. 5º, I
    birthDate: date('birth_date'),
    // LGPD: dado pessoal — Art. 5º, I — será criptografado via pgcrypto na Fase 4
    cpf: text('cpf').notNull(),
    // LGPD: Art. 7º — base legal que justifica o tratamento dos dados deste titular
    legalBasis: legalBasisEnum('legal_basis').notNull().default('consent'),
    // LGPD: Art. 6º, I — finalidade — prazo de retenção determinado pela base legal (Fase 3)
    retentionExpiresAt: timestamp('retention_expires_at'),
    // LGPD: Art. 5º, XI — anonimização elimina identificação direta do titular
    anonymizedAt: timestamp('anonymized_at'),
    // LGPD: Art. 5º, XIV — eliminação: soft delete preserva integridade referencial
    deletedAt: timestamp('deleted_at'),
    // LGPD: Art. 6º, X — responsabilização — registro temporal da criação do vínculo
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade de alterações nos dados
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Admin e recepcionista gerenciam pacientes
    pgPolicy('patients_admin_receptionist', {
      using: sql`current_setting('app.current_role', true) IN ('admin', 'receptionist')`,
    }),
    // LGPD: Art. 11, II, f — médico acessa para fins de tratamento de saúde (somente leitura)
    pgPolicy('patients_doctor_read', {
      for: 'select',
      using: sql`current_setting('app.current_role', true) = 'doctor'`,
    }),
    // LGPD: Art. 6º, III — titular acessa apenas o próprio registro
    pgPolicy('patients_self', {
      using: sql`
        current_setting('app.current_role', true) = 'patient'
        AND ${t.userId}::text = current_setting('app.current_user_id', true)
      `,
    }),
  ],
)

export type Patient = typeof patients.$inferSelect
export type NewPatient = typeof patients.$inferInsert
