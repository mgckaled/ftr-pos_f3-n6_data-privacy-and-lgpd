import { z } from 'zod'
import { insertPatientBodySchema } from '@medagenda/shared'

export { insertPatientBodySchema }

// LGPD: Art. 6º, III — necessidade — resposta retorna apenas campos necessários ao consumidor
export const patientResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  birthDate: z.string().nullable(),
  legalBasis: z.string(),
  retentionExpiresAt: z.string().nullable(),
  anonymizedAt: z.string().nullable(),
  deletedAt: z.string().nullable(),
  createdAt: z.string(),
})

export const patientListResponseSchema = z.object({
  patients: z.array(patientResponseSchema),
  total: z.number(),
})

export type PatientResponse = z.infer<typeof patientResponseSchema>
