import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'
import { insertPatientBodySchema } from './schema.js'
import { createPatientService, getPatientService, listPatientsService } from './service.js'

export async function patientsPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /patients — criação de paciente com consentimento (recepcionista)
  // LGPD: Art. 8º — consentimento coletado e registrado atomicamente no cadastro
  server.post(
    '/',
    {
      preHandler: [authenticate, requireRole('admin', 'receptionist')],
      schema: { body: insertPatientBodySchema },
    },
    async (request, reply) => {
      const result = await createPatientService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.body,
      )

      return reply.status(201).send({ id: result.patient.id })
    },
  )

  // GET /patients — listagem sem CPF (princípio da necessidade)
  // LGPD: Art. 6º, III — necessidade — CPF nunca retornado em listagens
  server.get(
    '/',
    {
      preHandler: [authenticate, requireRole('admin', 'doctor', 'receptionist')],
    },
    async (request, reply) => {
      const result = await listPatientsService(request.user.userId, request.user.role)

      return reply.status(200).send({ patients: result, total: result.length })
    },
  )

  // GET /patients/:id — detalhe do paciente com audit log automático
  // LGPD: Art. 6º, X — cada acesso a dados pessoais gera entrada em audit_logs
  server.get(
    '/:id',
    {
      preHandler: [authenticate, requireRole('admin', 'doctor', 'receptionist')],
      schema: { params: z.object({ id: z.string().uuid() }) },
    },
    async (request, reply) => {
      const patient = await getPatientService(
        request.user.userId,
        request.user.role,
        request.ip,
        request.params.id,
      )

      if (!patient) return reply.status(404).send({ error: 'Paciente não encontrado' })

      return reply.status(200).send(patient)
    },
  )
}
