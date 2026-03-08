import { z } from 'zod'
export {
  insertAppointmentBodySchema,
  appointmentResponseSchema,
  appointmentStatuses,
} from '@medagenda/shared'

// LGPD: Art. 5º, XI — resposta de estatísticas anonimizadas sem identificadores pessoais
export const appointmentStatsResponseSchema = z.object({
  month: z.string(),
  total: z.number().int(),
  completed: z.number().int(),
  cancelled: z.number().int(),
  noShow: z.number().int(),
})

export const appointmentStatsListResponseSchema = z.object({
  stats: z.array(appointmentStatsResponseSchema),
})

// Schema para o corpo do prontuário médico
// LGPD: Art. 11 — dados sensíveis de saúde com base legal específica
export const insertMedicalRecordBodySchema = z.object({
  appointmentId: z.string().uuid(),
  diagnosis: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  prescription: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  clinicalNotes: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  icdCode: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  sensitiveLegalBasis: z
    .enum(['health_care', 'vital_interest', 'research_anonymized', 'legal_obligation'])
    .default('health_care'),
})

export type InsertMedicalRecordBody = z.infer<typeof insertMedicalRecordBodySchema>

export const medicalRecordResponseSchema = z.object({
  id: z.string().uuid(),
  appointmentId: z.string().uuid(),
  patientId: z.string().uuid(),
  doctorId: z.string().uuid(),
  diagnosis: z.string().nullable(), // LGPD: dado sensível — Art. 5º, II
  prescription: z.string().nullable(), // LGPD: dado sensível — Art. 5º, II
  clinicalNotes: z.string().nullable(), // LGPD: dado sensível — Art. 5º, II
  icdCode: z.string().nullable(), // LGPD: dado sensível — Art. 5º, II
  sensitiveLegalBasis: z.string(),
  retentionExpiresAt: z.string(),
  createdAt: z.string(),
})
