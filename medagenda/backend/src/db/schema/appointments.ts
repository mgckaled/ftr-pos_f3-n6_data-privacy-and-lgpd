import { sql } from 'drizzle-orm'
import {
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core'
import { appointmentStatusEnum } from './enums'
import { patients } from './patients'
import { users } from './users'

// LGPD: Art. 5º, I — dados pessoais indiretos (agendamento vincula paciente e médico)
// Retenção obrigatória de 20 anos por resolução CFM nº 1.821/2007
export const appointments = pgTable(
  'appointments',
  {
    // LGPD: Art. 6º, VII — identificador sem exposição de dado pessoal
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 6º, III — necessidade — vínculo mínimo com o titular
    patientId: uuid('patient_id')
      .notNull()
      .references(() => patients.id),
    // LGPD: Art. 6º, III — necessidade — médico responsável pelo atendimento
    doctorId: uuid('doctor_id')
      .notNull()
      .references(() => users.id),
    // LGPD: dado pessoal — Art. 5º, I — data e hora vinculam o titular a um evento de saúde
    scheduledAt: timestamp('scheduled_at').notNull(),
    // LGPD: Art. 5º, XIV — estado explícito do ciclo de vida do agendamento
    status: appointmentStatusEnum('status').notNull().default('scheduled'),
    // LGPD: dado pessoal — Art. 5º, I — observações da recepcionista sobre o atendimento
    notes: text('notes'),
    // LGPD: Art. 6º, I — finalidade — prazo de retenção obrigatório (CFM: 20 anos)
    retentionExpiresAt: timestamp('retention_expires_at').notNull(),
    // LGPD: Art. 5º, XIV — soft delete: elimina acesso mas preserva integridade referencial
    deletedAt: timestamp('deleted_at'),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade da criação
    createdAt: timestamp('created_at').notNull().defaultNow(),
    // LGPD: Art. 6º, X — responsabilização — rastreabilidade de alterações
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    // Admin e recepcionista gerenciam todos os agendamentos
    pgPolicy('appointments_admin_receptionist', {
      using: sql`current_setting('app.current_role', true) IN ('admin', 'receptionist')`,
    }),
    // LGPD: Art. 11, II, f — médico acessa apenas consultas das quais é responsável
    pgPolicy('appointments_doctor_own', {
      for: 'select',
      using: sql`
        current_setting('app.current_role', true) = 'doctor'
        AND ${t.doctorId}::text = current_setting('app.current_user_id', true)
      `,
    }),
  ],
)

export type Appointment = typeof appointments.$inferSelect
export type NewAppointment = typeof appointments.$inferInsert
