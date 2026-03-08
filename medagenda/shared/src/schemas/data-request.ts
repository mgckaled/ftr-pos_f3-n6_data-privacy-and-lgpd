import { z } from 'zod'

// LGPD: Art. 18 — tipos de solicitações de direitos do titular (rol taxativo)
export const dataRequestTypes = [
  'access',
  'correction',
  'deletion',
  'portability',
  'anonymization',
  'revoke_consent',
  'information',
  'automated_decision_review',
] as const

// LGPD: Art. 18 — rótulos em linguagem simples para exibição ao titular
export const dataRequestTypeLabels: Record<DataRequestType, string> = {
  access: 'Acesso aos meus dados',
  correction: 'Correção de dados incorretos',
  deletion: 'Eliminação dos meus dados',
  portability: 'Portabilidade dos dados',
  anonymization: 'Anonimização',
  revoke_consent: 'Revogação de consentimento',
  information: 'Informações sobre o tratamento',
  automated_decision_review: 'Revisão de decisão automatizada',
}

// LGPD: Art. 18 — schema de criação de solicitação pelo titular
export const createDataRequestBodySchema = z.object({
  type: z.enum(dataRequestTypes),
  // LGPD: Art. 6º, III — princípio da necessidade — razão é opcional
  reason: z.string().max(1000).optional(),
})

export type DataRequestType = (typeof dataRequestTypes)[number]
export type CreateDataRequestBody = z.infer<typeof createDataRequestBodySchema>
