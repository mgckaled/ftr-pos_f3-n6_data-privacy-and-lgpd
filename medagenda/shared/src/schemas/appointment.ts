import { z } from 'zod'

// LGPD: Art. 5º, XIV — estados do ciclo de vida do agendamento
export const appointmentStatuses = [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
] as const

export type AppointmentStatus = (typeof appointmentStatuses)[number]

// Schema principal — fonte única de verdade para backend e frontend
// LGPD: Art. 6º, III — necessidade — apenas campos indispensáveis ao agendamento
export const insertAppointmentBodySchema = z.object({
  patientId: z.string().uuid('ID do paciente inválido'), // LGPD: dado pessoal — Art. 5º, I
  doctorId: z.string().uuid('ID do médico inválido'), // LGPD: dado pessoal — Art. 5º, I
  // LGPD: dado pessoal — Art. 5º, I — data/hora vincula o titular a evento de saúde
  scheduledAt: z.string().datetime('Data e hora inválidas (formato ISO 8601 esperado)'),
  notes: z.string().optional(), // LGPD: dado pessoal — Art. 5º, I
})

export type InsertAppointmentBody = z.infer<typeof insertAppointmentBodySchema>

// Schema de resposta padronizado para listagem/detalhe
export const appointmentResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(), // LGPD: dado pessoal — Art. 5º, I
  doctorId: z.string().uuid(), // LGPD: dado pessoal — Art. 5º, I
  scheduledAt: z.string(), // LGPD: dado pessoal — Art. 5º, I
  status: z.enum(appointmentStatuses),
  notes: z.string().nullable(), // LGPD: dado pessoal — Art. 5º, I
  retentionExpiresAt: z.string(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
})

export type AppointmentResponse = z.infer<typeof appointmentResponseSchema>
