import { sql } from 'drizzle-orm'
import {
  pgPolicy,
  pgSchema,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { sensitiveLegalBasisEnum } from './enums'
import { appointments } from './appointments'
import { patients } from './patients'
import { users } from './users'

// LGPD: Art. 5º, II — dados sensíveis de saúde isolados no schema 'private'
// com políticas RLS próprias e base legal exclusiva do Art. 11
const privateSchema = pgSchema('private')

// LGPD: Art. 11 — tratamento de dados sensíveis de saúde exige base legal específica
// Retenção obrigatória de 20 anos por resolução CFM nº 1.821/2007
export const medicalRecords = privateSchema.table(
  'medical_records',
  {
    // LGPD: Art. 6º, VII — identificador sem exposição de dado sensível
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 6º, III — vínculo com a consulta (cardinalidade 1:1)
    appointmentId: uuid('appointment_id')
      .notNull()
      .unique()
      .references(() => appointments.id),
    // LGPD: Art. 6º, III — necessidade — vínculo direto com o titular
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    // LGPD: Art. 6º, III — médico que realizou o atendimento e detém responsabilidade
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    // LGPD: dado sensível — Art. 5º, II — diagnóstico clínico
    diagnosis: text('diagnosis'),
    // LGPD: dado sensível — Art. 5º, II — prescrição médica
    prescription: text('prescription'),
    // LGPD: dado sensível — Art. 5º, II — anotações clínicas do médico
    clinicalNotes: text('clinical_notes'),
    // LGPD: dado sensível — Art. 5º, II — classificação CID (Código Internacional de Doenças)
    icdCode: text('icd_code'),
    // LGPD: Art. 11 — base legal para dados sensíveis (diferente do Art. 7º)
    sensitiveLegalBasis: sensitiveLegalBasisEnum('sensitive_legal_basis')
      .notNull()
      .default('health_care'),
    // LGPD: Art. 6º, I — finalidade — prazo de retenção obrigatório (CFM: 20 anos)
    retentionExpiresAt: timestamp('retention_expires_at').notNull(),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade da criação
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade de alterações
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // LGPD: Art. 11, II, f — médico acessa apenas prontuários que ele próprio criou
    pgPolicy('medical_records_doctor_own', {
      using: sql`
        current_setting('app.current_role', true) = 'doctor'
        AND ${t.doctorId}::text = current_setting('app.current_user_id', true)
      `,
    }),
    // LGPD: Art. 6º, X — responsabilização — admin/DPO tem acesso de leitura para auditoria
    pgPolicy('medical_records_admin_read', {
      for: 'select',
      using: sql`current_setting('app.current_role', true) = 'admin'`,
    }),
  ],
)

export type MedicalRecord = typeof medicalRecords.$inferSelect
export type NewMedicalRecord = typeof medicalRecords.$inferInsert
