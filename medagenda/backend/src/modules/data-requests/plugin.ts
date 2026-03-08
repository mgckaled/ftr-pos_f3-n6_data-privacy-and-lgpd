// LGPD: Art. 18 — endpoints de direitos do titular com SLA de 15 dias corridos
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import {
  completeDataRequestBodySchema,
  createDataRequestBodySchema,
  dataRequestListResponseSchema,
  dataRequestResponseSchema,
  denyDataRequestBodySchema,
} from './schema.js'
import {
  completeDataRequestService,
  createDataRequestService,
  denyDataRequestService,
  getDataRequestService,
  listDataRequestsService,
} from './service.js'

export async function dataRequestsPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /data-requests — titular cria solicitação de exercício de direito
  // LGPD: Art. 18 — rol taxativo de direitos: acesso, correção, eliminação, portabilidade, etc.
  server.post(
    '/',
    {
      preHandler: [authenticate, requireRole('patient', 'admin')],
      schema: {
        tags: ['data-requests'],
        summary: 'Criar solicitação de exercício de direito',
        description:
          'LGPD Art. 18 — titular cria solicitação formal. ' +
          'SLA de 15 dias corridos (Art. 18, §5º). ' +
          'RLS garante que patient só cria solicitações vinculadas ao próprio patientId.',
        body: createDataRequestBodySchema,
        response: { 201: dataRequestResponseSchema },
      },
    },
    async (request, reply) => {
      const dataRequest = await createDataRequestService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.body,
      )
      return reply.status(201).send(dataRequest)
    },
  )

  // GET /data-requests — lista solicitações; RLS filtra: admin vê tudo, patient vê apenas as próprias
  // LGPD: Art. 18 — titular acompanha suas solicitações; DPO monitora fila com SLA
  server.get(
    '/',
    {
      preHandler: [authenticate, requireRole('patient', 'admin')],
      schema: {
        tags: ['data-requests'],
        summary: 'Listar solicitações de direitos',
        description:
          'LGPD Art. 18 — retorna slaStatus e slaRemainingDays para monitoramento do SLA de 15 dias. ' +
          'RLS: admin vê todas as solicitações; patient vê apenas as próprias.',
        response: { 200: dataRequestListResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await listDataRequestsService(request.user.userId, request.user.role)
      return reply.status(200).send(result)
    },
  )

  // GET /data-requests/:id — detalhe de solicitação individual
  // LGPD: Art. 18 — rastreabilidade individual da solicitação
  server.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole('patient', 'admin')],
      schema: {
        tags: ['data-requests'],
        summary: 'Detalhe de solicitação de direito',
        description: 'LGPD Art. 18 — detalhe com status do SLA calculado em tempo real.',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: dataRequestResponseSchema, 404: z.object({ error: z.string() }) },
      },
    },
    async (request, reply) => {
      const dataRequest = await getDataRequestService(
        request.user.userId,
        request.user.role,
        request.params.id,
      )
      if (!dataRequest) return reply.status(404).send({ error: 'Solicitação não encontrada' })
      return reply.status(200).send(dataRequest)
    },
  )

  // PATCH /data-requests/:id/complete — admin conclui solicitação com resposta formal
  // LGPD: Art. 18, §3º — resposta formal do controlador ao titular é obrigatória
  server.patch(
    '/:id/complete',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['data-requests'],
        summary: 'Concluir solicitação com resposta formal',
        description:
          'LGPD Art. 18, §3º — controlador responde formalmente ao titular. ' +
          'Registra resolvedAt e processedBy para evidência auditável.',
        params: z.object({ id: z.string().uuid() }),
        body: completeDataRequestBodySchema,
        response: { 200: dataRequestResponseSchema, 404: z.object({ error: z.string() }) },
      },
    },
    async (request, reply) => {
      const dataRequest = await completeDataRequestService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.id,
        request.body,
      )
      if (!dataRequest) return reply.status(404).send({ error: 'Solicitação não encontrada' })
      return reply.status(200).send(dataRequest)
    },
  )

  // PATCH /data-requests/:id/deny — admin nega solicitação com justificativa obrigatória
  // LGPD: Art. 18 — negação deve ser fundamentada e comunicada ao titular
  server.patch(
    '/:id/deny',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['data-requests'],
        summary: 'Negar solicitação com justificativa',
        description:
          'LGPD Art. 18 — negação fundamentada com justificativa obrigatória. ' +
          'Registra resolvedAt e processedBy para evidência auditável.',
        params: z.object({ id: z.string().uuid() }),
        body: denyDataRequestBodySchema,
        response: { 200: dataRequestResponseSchema, 404: z.object({ error: z.string() }) },
      },
    },
    async (request, reply) => {
      const dataRequest = await denyDataRequestService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.id,
        request.body,
      )
      if (!dataRequest) return reply.status(404).send({ error: 'Solicitação não encontrada' })
      return reply.status(200).send(dataRequest)
    },
  )
}
