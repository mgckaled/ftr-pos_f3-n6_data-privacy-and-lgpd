// LGPD: Art. 18 — schemas Zod para o painel do titular
import { z } from 'zod'

const consentSchema = z.object({
  id: z.string().uuid(),
  purpose: z.string(),
  granted: z.boolean(),
  grantedAt: z.string(),
  revokedAt: z.string().nullable(),
  policyVersion: z.string(),
})

// LGPD: Art. 18, I e III — dados retornados ao titular para visualização e correção
// CPF NUNCA incluído na resposta (Art. 6º, III — princípio da necessidade)
export const privacyMeResponseSchema = z.object({
  patient: z.object({
    id: z.string().uuid(),
    name: z.string(),
    email: z.string().nullable(),
    phone: z.string().nullable(),
    birthDate: z.string().nullable(),
    legalBasis: z.string(),
    retentionExpiresAt: z.string().nullable(),
    createdAt: z.string(),
  }),
  consents: z.array(consentSchema),
})

// LGPD: Art. 18, III — campos corrigíveis pelo titular
// Nunca incluir: CPF, base legal, timestamps de sistema
export const updatePrivacyMeBodySchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
})

export type PrivacyMeResponse = z.infer<typeof privacyMeResponseSchema>
export type UpdatePrivacyMeBody = z.infer<typeof updatePrivacyMeBodySchema>
