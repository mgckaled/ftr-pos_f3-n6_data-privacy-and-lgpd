// LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — schemas Zod para notificação de incidentes
import { z } from 'zod'

export const insertIncidentBodySchema = z.object({
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  // Resolução CD/ANPD nº 15/2024 — classificação de risco
  severity: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  // LGPD: Art. 48 + Resolução — marco zero do prazo de 72h para notificação à ANPD
  detectedAt: z.string().datetime({ message: 'detectedAt deve ser ISO 8601 com timezone' }),
  // LGPD: Art. 48, §1º, I — número estimado de titulares afetados
  affectedCount: z.number().int().positive().optional(),
  // LGPD: Art. 48, §1º, II — categorias de dados comprometidos (tabelas/sistemas)
  affectedResources: z.array(z.string()).optional(),
  // LGPD: Art. 48, §1º, III — medidas de contenção adotadas
  containmentMeasures: z.string().optional(),
})

export const incidentResponseSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string().nullable(),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  status: z.enum(['open', 'notified', 'resolved']),
  detectedAt: z.string(),
  notifiedAnpdAt: z.string().nullable(),
  // Computed — calculado a partir de detectedAt e notifiedAnpdAt
  // Resolução CD/ANPD nº 15/2024 — prazo de 72h; alerta quando restam < 12h
  anpdAlertStatus: z.enum(['compliant', 'pending', 'urgent', 'overdue']),
  // Tempo restante em horas até o prazo de 72h (negativo se vencido)
  anpdDeadlineRemainingHours: z.number(),
  affectedCount: z.number().nullable(),
  affectedResources: z.array(z.string()).nullable(),
  containmentMeasures: z.string().nullable(),
  reportedBy: z.string().uuid(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const incidentListResponseSchema = z.object({
  incidents: z.array(incidentResponseSchema),
  total: z.number(),
  // Contagem de incidentes com alerta urgente ou vencido — para o dashboard DPO
  urgentCount: z.number(),
})

export type InsertIncidentBody = z.infer<typeof insertIncidentBodySchema>
export type IncidentResponse = z.infer<typeof incidentResponseSchema>
