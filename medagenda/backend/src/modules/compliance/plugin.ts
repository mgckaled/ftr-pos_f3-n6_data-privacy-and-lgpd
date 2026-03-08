// LGPD: Art. 37 (ROPA) + Art. 6º, X (conformidade) — endpoints para o DPO
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import {
  auditLogListResponseSchema,
  complianceReportSchema,
  ropaResponseSchema,
} from './schema.js'
import {
  getComplianceReportService,
  getRopaService,
  listAuditLogsService,
} from './service.js'

export async function compliancePlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /compliance/ropa — ROPA gerado dinamicamente a partir dos audit_logs
  // LGPD: Art. 37 + Resolução CD/ANPD nº 2/2022 — Registro de Operações de Tratamento
  server.get(
    '/ropa',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['compliance'],
        summary: 'ROPA — Registro de Operações de Tratamento',
        description:
          'LGPD Art. 37 + Resolução CD/ANPD nº 2/2022 — documento de conformidade com ' +
          '7 atividades de tratamento enriquecidas com métricas reais dos audit_logs. ' +
          'Evidência auditável do cumprimento da obrigação de registro.',
        response: { 200: ropaResponseSchema },
      },
    },
    async (request, reply) => {
      const ropa = await getRopaService(request.user.userId, request.user.role)
      return reply.status(200).send(ropa)
    },
  )

  // GET /compliance/report — métricas de conformidade exportáveis
  // LGPD: Art. 6º, X — responsabilização — evidência auditável do controlador
  server.get(
    '/report',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['compliance'],
        summary: 'Relatório de conformidade exportável',
        description:
          'LGPD Art. 6º, X — métricas agregadas: consentimentos, data_requests (SLA), ' +
          'incidentes (urgência ANPD), audit_logs e estado dos pacientes. ' +
          'Nenhum dado pessoal identificável — apenas COUNT/SUM/AVG (princípio da necessidade). ' +
          'Parâmetro ?download=true adiciona Content-Disposition para download.',
        querystring: z.object({
          download: z.string().optional(),
        }),
        response: { 200: complianceReportSchema },
      },
    },
    async (request, reply) => {
      const report = await getComplianceReportService(request.user.userId, request.user.role)
      const { download } = request.query as { download?: string }
      if (download === 'true') {
        reply.header(
          'Content-Disposition',
          `attachment; filename="relatorio-conformidade-${new Date().toISOString().slice(0, 10)}.json"`,
        )
      }
      return reply.status(200).send(report)
    },
  )

  // GET /compliance/audit-logs — listagem paginada de audit logs para o DPO
  // LGPD: Art. 6º, X — responsabilização — rastreabilidade completa das operações
  server.get(
    '/audit-logs',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['compliance'],
        summary: 'Listar audit logs (paginado)',
        description:
          'LGPD Art. 6º, X — audit logs com patientToken (pseudonimização), nunca patientId direto. ' +
          'Paginação via ?page=1&pageSize=50.',
        querystring: z.object({
          page: z.coerce.number().int().min(1).default(1),
          pageSize: z.coerce.number().int().min(1).max(100).default(50),
        }),
        response: { 200: auditLogListResponseSchema },
      },
    },
    async (request, reply) => {
      const { page, pageSize } = request.query as { page: number; pageSize: number }
      const result = await listAuditLogsService(
        request.user.userId,
        request.user.role,
        page,
        pageSize,
      )
      return reply.status(200).send(result)
    },
  )
}
