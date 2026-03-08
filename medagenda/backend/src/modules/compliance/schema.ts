// LGPD: Art. 37 (ROPA) + Art. 6º, X (relatório de conformidade) — schemas Zod
import { z } from 'zod'

// LGPD: Art. 37 — Resolução CD/ANPD nº 2/2022 — estrutura de atividade de tratamento
export const ropaActivitySchema = z.object({
  activityName: z.string(),
  purpose: z.string(),
  legalBasis: z.string(),
  dataCategories: z.array(z.string()),
  dataSubjects: z.string(),
  recipients: z.string(),
  retentionPeriod: z.string(),
  technicalMeasures: z.array(z.string()),
  // Estatística dinâmica extraída dos audit_logs — prova de uso real
  operationCount: z.number(),
  lastOperationAt: z.string().nullable(),
})

// LGPD: Art. 37 — ROPA completo como documento de conformidade
export const ropaResponseSchema = z.object({
  documentTitle: z.string(),
  generatedAt: z.string(),
  version: z.string(),
  legalReference: z.string(),
  controller: z.object({
    name: z.string(),
    contact: z.string(),
  }),
  activities: z.array(ropaActivitySchema),
  totalOperationsAudited: z.number(),
  periodCovered: z.object({ from: z.string(), to: z.string() }),
})

// LGPD: Art. 6º, X — relatório de conformidade exportável como evidência auditável
export const complianceReportSchema = z.object({
  generatedAt: z.string(),
  period: z.object({ from: z.string(), to: z.string() }),
  consents: z.object({
    total: z.number(),
    granted: z.number(),
    revoked: z.number(),
    byPurpose: z.record(
      z.string(),
      z.object({ granted: z.number(), revoked: z.number() }),
    ),
  }),
  dataRequests: z.object({
    total: z.number(),
    byStatus: z.record(z.string(), z.number()),
    byType: z.record(z.string(), z.number()),
    avgResolutionDays: z.number().nullable(),
    overdueCount: z.number(),
  }),
  incidents: z.object({
    total: z.number(),
    bySeverity: z.record(z.string(), z.number()),
    urgentOrOverdue: z.number(),
  }),
  auditLogs: z.object({
    total: z.number(),
    byAction: z.record(z.string(), z.number()),
    byResource: z.record(z.string(), z.number()),
  }),
  patients: z.object({
    total: z.number(),
    active: z.number(),
    anonymized: z.number(),
    deleted: z.number(),
  }),
})

// LGPD: Art. 6º, X — audit log listado para o DPO: patientToken visível, patientId nunca
export const auditLogListResponseSchema = z.object({
  logs: z.array(
    z.object({
      id: z.string().uuid(),
      userId: z.string().uuid().nullable(),
      patientToken: z.string().nullable(),
      action: z.string(),
      resource: z.string(),
      resourceId: z.string().nullable(),
      legalBasis: z.string().nullable(),
      ipAddress: z.string().nullable(),
      metadata: z.any().nullable(),
      createdAt: z.string(),
    }),
  ),
  total: z.number(),
  page: z.number(),
  pageSize: z.number(),
})

export type RopaResponse = z.infer<typeof ropaResponseSchema>
export type ComplianceReport = z.infer<typeof complianceReportSchema>
