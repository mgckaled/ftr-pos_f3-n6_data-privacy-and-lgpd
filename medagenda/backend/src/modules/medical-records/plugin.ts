import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import { insertMedicalRecordBodySchema } from './schema.js'
import { createMedicalRecordService, getMedicalRecordService } from './service.js'

export async function medicalRecordsPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /medical-records — criar prontuário (doctor only)
  // LGPD: Art. 11 — dados sensíveis de saúde: base legal específica e acesso restrito
  server.post(
    '/',
    {
      preHandler: [authenticate, requireRole('doctor')],
      schema: {
        tags: ['medical-records'],
        summary: 'Registrar prontuário médico',
        description: 'LGPD Art. 11 — dado sensível de saúde; acesso restrito ao médico responsável',
        body: insertMedicalRecordBodySchema,
        response: { 201: z.object({ id: z.string().uuid() }) },
      },
    },
    async (request, reply) => {
      const record = await createMedicalRecordService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.body,
      )
      return reply.status(201).send({ id: record.id })
    },
  )

  // GET /medical-records/:appointmentId — ler prontuário
  // LGPD: Art. 6º, X — leitura de dado sensível registrada em audit_logs
  // LGPD: Art. 5º, II — dado sensível: não armazenar em estado global ou cache
  server.get(
    '/:appointmentId',
    {
      preHandler: [authenticate, requireRole('admin', 'doctor')],
      schema: {
        tags: ['medical-records'],
        summary: 'Ler prontuário por agendamento',
        description: 'LGPD Art. 5º, II — dado sensível: descartado ao desmontar componente no frontend',
        params: z.object({ appointmentId: z.string().uuid() }),
      },
    },
    async (request, reply) => {
      const record = await getMedicalRecordService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.appointmentId,
      )

      if (!record) return reply.status(404).send({ error: 'Prontuário não encontrado' })

      return reply.status(200).send(record)
    },
  )
}
