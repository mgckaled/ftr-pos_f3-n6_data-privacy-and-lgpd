// LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — endpoints de notificação de incidentes
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import {
  insertIncidentBodySchema,
  incidentResponseSchema,
  incidentListResponseSchema,
} from './schema.js'
import {
  createIncidentService,
  listIncidentsService,
  getIncidentService,
  notifyAnpdService,
} from './service.js'

export async function incidentsPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /incidents — registrar incidente de segurança
  // LGPD: Art. 48 — controlador deve comunicar incidentes que possam acarretar risco aos titulares
  server.post(
    '/',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['incidents'],
        summary: 'Registrar incidente de segurança',
        description:
          'LGPD Art. 48 + Resolução CD/ANPD nº 15/2024 — ' +
          'registra incidente e inicia contagem do prazo de 72h para notificação à ANPD',
        body: insertIncidentBodySchema,
        response: { 201: incidentResponseSchema },
      },
    },
    async (request, reply) => {
      const incident = await createIncidentService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.body,
      )
      return reply.status(201).send(incident)
    },
  )

  // GET /incidents — listar incidentes com status do prazo 72h
  // LGPD: Art. 48 — DPO monitora prazo de notificação à ANPD
  server.get(
    '/',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['incidents'],
        summary: 'Listar incidentes com alerta de prazo ANPD',
        description:
          'Resolução CD/ANPD nº 15/2024 — retorna anpdAlertStatus: ' +
          '"compliant" | "pending" | "urgent" (< 12h) | "overdue" (vencido)',
        response: { 200: incidentListResponseSchema },
      },
    },
    async (request, reply) => {
      const result = await listIncidentsService(request.user.userId, request.user.role)
      return reply.status(200).send(result)
    },
  )

  // GET /incidents/:id — detalhe do incidente
  // LGPD: Art. 48 — rastreabilidade individual do incidente
  server.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['incidents'],
        summary: 'Detalhe do incidente',
        description: 'LGPD Art. 48 — detalhe com status calculado em tempo real do prazo de 72h',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: incidentResponseSchema },
      },
    },
    async (request, reply) => {
      const incident = await getIncidentService(
        request.user.userId,
        request.user.role,
        request.params.id,
      )
      if (!incident) return reply.status(404).send({ error: 'Incidente não encontrado' })
      return reply.status(200).send(incident)
    },
  )

  // PATCH /incidents/:id/notify-anpd — registrar notificação formal à ANPD
  // LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — persiste timestamp como prova do cumprimento
  server.patch(
    '/:id/notify-anpd',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['incidents'],
        summary: 'Registrar notificação à ANPD',
        description:
          'Resolução CD/ANPD nº 15/2024 — seta notifiedAnpdAt e muda status para "notified". ' +
          'Idempotente: retorna estado atual se já notificado.',
        params: z.object({ id: z.string().uuid() }),
        response: { 200: incidentResponseSchema },
      },
    },
    async (request, reply) => {
      const incident = await notifyAnpdService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.id,
      )
      if (!incident) return reply.status(404).send({ error: 'Incidente não encontrado' })
      return reply.status(200).send(incident)
    },
  )
}
