// LGPD: Art. 18 — painel do titular: visualizar, corrigir, exportar e revogar consentimentos
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import { privacyMeResponseSchema, updatePrivacyMeBodySchema } from './schema.js'
import {
  exportPrivacyDataService,
  getPrivacyMeService,
  revokeConsentService,
  updatePrivacyMeService,
} from './service.js'

export async function privacyPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /privacy/me — titular visualiza os próprios dados e consentimentos
  // LGPD: Art. 18, I — direito de acesso aos dados
  server.get(
    '/me',
    {
      preHandler: [authenticate, requireRole('patient')],
      schema: {
        tags: ['privacy'],
        summary: 'Visualizar meus dados pessoais',
        description:
          'LGPD Art. 18, I — titular acessa os próprios dados. ' +
          'CPF não retornado (Art. 6º, III — necessidade). ' +
          'Acesso registrado em audit_logs com patientToken (pseudonimização).',
        response: { 200: privacyMeResponseSchema },
      },
    },
    async (request, reply) => {
      const data = await getPrivacyMeService(
        request.user.userId,
        request.user.role,
        request.ip,
      )
      return reply.status(200).send(data)
    },
  )

  // PATCH /privacy/me — titular corrige dados pessoais
  // LGPD: Art. 18, III — direito de correção de dados incompletos, inexatos ou desatualizados
  server.patch(
    '/me',
    {
      preHandler: [authenticate, requireRole('patient')],
      schema: {
        tags: ['privacy'],
        summary: 'Corrigir dados pessoais',
        description:
          'LGPD Art. 18, III — titular corrige nome, e-mail ou telefone. ' +
          'CPF, base legal e timestamps de sistema não são corrigíveis pelo titular. ' +
          'Alteração registrada em audit_logs com metadados dos campos modificados.',
        body: updatePrivacyMeBodySchema,
        response: {
          200: privacyMeResponseSchema.shape.patient,
        },
      },
    },
    async (request, reply) => {
      const updated = await updatePrivacyMeService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.body,
      )
      return reply.status(200).send(updated)
    },
  )

  // POST /privacy/consents/:purpose/revoke — titular revoga consentimento por finalidade
  // LGPD: Art. 18, IX — revogação de consentimento a qualquer momento
  server.post(
    '/consents/:purpose/revoke',
    {
      preHandler: [authenticate, requireRole('patient')],
      schema: {
        tags: ['privacy'],
        summary: 'Revogar consentimento por finalidade',
        description:
          'LGPD Art. 18, IX — titular revoga consentimento de finalidade específica a qualquer momento. ' +
          'Registra revokedAt no consentimento (imutável) e cria entrada em audit_logs. ' +
          'Retorna 404 se consentimento ativo não encontrado.',
        params: z.object({
          purpose: z.enum([
            'medical_treatment',
            'data_sharing_partners',
            'research',
            'insurance',
            'marketing',
          ]),
        }),
        response: {
          200: z.object({
            id: z.string().uuid(),
            purpose: z.string(),
            granted: z.boolean(),
            grantedAt: z.string(),
            revokedAt: z.string(),
            policyVersion: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const revoked = await revokeConsentService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.purpose,
      )
      return reply.status(200).send(revoked)
    },
  )

  // GET /privacy/export?format=json|csv — titular exporta todos os dados pessoais
  // LGPD: Art. 18, V — portabilidade; Art. 18, VI — informação sobre compartilhamento
  // NOTA: medical_records não incluídos — Art. 11 exige tratamento diferenciado para dados sensíveis
  server.get(
    '/export',
    {
      preHandler: [authenticate, requireRole('patient')],
      schema: {
        tags: ['privacy'],
        summary: 'Exportar dados pessoais (portabilidade)',
        description:
          'LGPD Art. 18, V — portabilidade: exporta dados pessoais, consentimentos e solicitações. ' +
          'Formato json retorna objeto JSON; formato csv retorna arquivo para download. ' +
          'Prontuários médicos (Art. 11) não incluídos — dados sensíveis exigem tratamento diferenciado. ' +
          'Exportação registrada em audit_logs.',
        querystring: z.object({
          format: z.enum(['json', 'csv']).default('json'),
        }),
        // Schema de resposta z.any() — conteúdo varia por format (JSON object ou CSV string)
        response: { 200: z.any() },
      },
    },
    async (request, reply) => {
      const { format } = request.query as { format: 'json' | 'csv' }
      const result = await exportPrivacyDataService(
        request.user.userId,
        request.user.role,
        request.ip,
        format,
      )

      if (format === 'csv') {
        reply.header('Content-Type', 'text/csv; charset=utf-8')
        reply.header('Content-Disposition', `attachment; filename="${result.filename}"`)
        return reply.status(200).send(result.data)
      }

      reply.header('Content-Disposition', `attachment; filename="${result.filename}"`)
      return reply.status(200).send(result.data)
    },
  )
}
