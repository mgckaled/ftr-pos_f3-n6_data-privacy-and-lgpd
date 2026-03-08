// LGPD: Art. 18 — schemas Zod para o módulo de direitos do titular
import { z } from 'zod'

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

export const dataRequestStatuses = [
  'pending',
  'in_progress',
  'completed',
  'denied',
  'expired',
] as const

// LGPD: Art. 18 — titular cria solicitação com tipo e razão opcional
export const createDataRequestBodySchema = z.object({
  type: z.enum(dataRequestTypes),
  reason: z.string().max(1000).optional(),
})

// LGPD: Art. 18, §3º — admin conclui com resposta formal obrigatória ao titular
export const completeDataRequestBodySchema = z.object({
  response: z.string().min(1).max(2000),
})

// LGPD: Art. 18 — admin nega com justificativa obrigatória
export const denyDataRequestBodySchema = z.object({
  response: z.string().min(1).max(2000),
})

// LGPD: Art. 18, §5º — SLA de 15 dias: ok > 5 dias, warning 1-5 dias, critical < 1 dia
export const slaStatuses = ['ok', 'warning', 'critical'] as const

export const dataRequestResponseSchema = z.object({
  id: z.string().uuid(),
  patientId: z.string().uuid(),
  type: z.enum(dataRequestTypes),
  status: z.enum(dataRequestStatuses),
  reason: z.string().nullable(),
  response: z.string().nullable(),
  processedBy: z.string().uuid().nullable(),
  deadlineAt: z.string(),
  requestedAt: z.string(),
  resolvedAt: z.string().nullable(),
  // LGPD: Art. 18, §5º — status calculado do SLA para monitoramento pelo DPO
  slaStatus: z.enum(slaStatuses),
  slaRemainingDays: z.number(),
})

export const dataRequestListResponseSchema = z.object({
  dataRequests: z.array(dataRequestResponseSchema),
  total: z.number(),
  // LGPD: Art. 6º, X — responsabilização — contadores para monitoramento do DPO
  pendingCount: z.number(),
  overdueCount: z.number(),
})

export type CreateDataRequestBody = z.infer<typeof createDataRequestBodySchema>
export type CompleteDataRequestBody = z.infer<typeof completeDataRequestBodySchema>
export type DenyDataRequestBody = z.infer<typeof denyDataRequestBodySchema>
export type DataRequestResponse = z.infer<typeof dataRequestResponseSchema>
export type DataRequestType = (typeof dataRequestTypes)[number]
export type DataRequestStatus = (typeof dataRequestStatuses)[number]
