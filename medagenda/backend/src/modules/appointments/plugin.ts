import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import {
  insertAppointmentBodySchema,
  appointmentStatsListResponseSchema,
} from './schema.js'
import {
  createAppointmentService,
  listAppointmentsService,
  getAppointmentService,
  cancelAppointmentService,
  getAppointmentStatsService,
} from './service.js'

export async function appointmentsPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /appointments/stats — estatísticas anonimizadas (admin/DPO)
  // LGPD: Art. 5º, XI — dados anonimizados: sem identificadores pessoais na resposta
  // Registrado ANTES de /:id para evitar conflito de rota
  server.get(
    '/stats',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['appointments'],
        summary: 'Estatísticas anonimizadas de agendamentos por mês',
        description: 'LGPD Art. 5º, XI — agregados sem identificadores pessoais',
        response: { 200: appointmentStatsListResponseSchema },
      },
    },
    async (request, reply) => {
      // LGPD: Art. 6º, VII — RLS ativado com contexto do usuário autenticado (admin)
      const stats = await getAppointmentStatsService(request.user.userId, request.user.role)
      return reply.status(200).send({ stats })
    },
  )

  // POST /appointments — criar agendamento
  // LGPD: Art. 6º, I — finalidade — agendamento para prestação de serviço de saúde
  server.post(
    '/',
    {
      preHandler: [authenticate, requireRole('admin', 'receptionist')],
      schema: {
        tags: ['appointments'],
        summary: 'Criar agendamento',
        description: 'LGPD Art. 6º, I — finalidade de atenção à saúde; retenção 20 anos (CFM)',
        body: insertAppointmentBodySchema,
        response: { 201: z.object({ id: z.string().uuid() }) },
      },
    },
    async (request, reply) => {
      const result = await createAppointmentService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.body,
      )
      return reply.status(201).send(result)
    },
  )

  // GET /appointments — listagem
  // LGPD: Art. 6º, III — necessidade — sem dados de prontuário na listagem
  server.get(
    '/',
    {
      preHandler: [authenticate, requireRole('admin', 'doctor', 'receptionist')],
      schema: {
        tags: ['appointments'],
        summary: 'Listar agendamentos',
        description: 'LGPD Art. 6º, III — necessidade — dados mínimos na listagem',
      },
    },
    async (request, reply) => {
      const result = await listAppointmentsService(request.user.userId, request.user.role)
      return reply.status(200).send({ appointments: result, total: result.length })
    },
  )

  // GET /appointments/:id — detalhe com audit log
  // LGPD: Art. 6º, X — cada acesso a dados pessoais registrado em audit_logs
  server.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole('admin', 'doctor', 'receptionist')],
      schema: {
        tags: ['appointments'],
        summary: 'Detalhe do agendamento',
        description: 'LGPD Art. 6º, X — acesso registrado em audit_logs com patientToken',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const appointment = await getAppointmentService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.id,
      )

      if (!appointment) return reply.status(404).send({ error: 'Agendamento não encontrado' })

      return reply.status(200).send(appointment)
    },
  )

  // PATCH /appointments/:id/cancel — cancelamento (soft delete)
  // LGPD: Art. 5º, XIV — soft delete preserva retenção obrigatória (CFM: 20 anos)
  server.patch(
    '/:id/cancel',
    {
      preHandler: [authenticate, requireRole('admin', 'doctor', 'receptionist')],
      schema: {
        tags: ['appointments'],
        summary: 'Cancelar agendamento',
        description: 'LGPD Art. 5º, XIV — soft delete: preserva dados para retenção obrigatória CFM',
        params: z.object({ id: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const result = await cancelAppointmentService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.id,
      )

      if (!result) {
        // Verifica se o agendamento existe para distinguir "não encontrado" de "já cancelado"
        const existing = await getAppointmentService(
          request.user.userId,
          request.user.role,
          request.ip,
          request.params.id,
        )
        if (existing) {
          // LGPD: Art. 5º, XIV — agendamento cancelado não pode ser cancelado novamente
          return reply.status(400).send({ error: 'Agendamento já está cancelado' })
        }
        return reply.status(404).send({ error: 'Agendamento não encontrado' })
      }

      return reply.status(200).send(result)
    },
  )
}
