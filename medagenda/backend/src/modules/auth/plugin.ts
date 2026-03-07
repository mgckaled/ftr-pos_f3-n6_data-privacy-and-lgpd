import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import type { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema/index.js'
import { recordAudit } from '../../middleware/audit.js'
import { authenticate } from '../../middleware/auth.js'
import { loginBodySchema } from './schema.js'
import { loginService } from './service.js'

export async function authPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // POST /auth/login
  server.post(
    '/login',
    { schema: { body: loginBodySchema } },
    async (request, reply) => {
      const { email, password } = request.body

      const result = await loginService(email, password)

      if (!result) {
        // LGPD: Art. 6º, X — tentativa de login falha é registrada (sem revelar motivo específico)
        await recordAudit(request, reply, {
          action: 'login',
          resource: 'users',
          legalBasis: 'legitimate_interest',
          metadata: { success: false, email },
        })

        return reply.status(401).send({ error: 'Credenciais inválidas' })
      }

      // LGPD: Art. 6º, VII — JWT exclusivamente em cookie httpOnly; nunca exposto ao JS do browser
      reply.setCookie('token', result.token, {
        httpOnly: true,
        sameSite: 'strict',
        path: '/',
        maxAge: 60 * 60, // 1 hora
        // secure: true — habilitar em produção (HTTPS obrigatório)
      })

      // LGPD: Art. 6º, X — login bem-sucedido registrado em audit_logs
      await recordAudit(request, reply, {
        userId: result.user.userId,
        action: 'login',
        resource: 'users',
        legalBasis: 'legitimate_interest',
        metadata: { success: true },
      })

      return reply.status(200).send(result.user)
    },
  )

  // GET /auth/me
  server.get(
    '/me',
    { preHandler: authenticate },
    async (request, reply) => {
      // LGPD: Art. 6º, III — necessidade — retorna apenas o mínimo necessário (sem dados extras)
      const user = await db.query.users.findFirst({
        where: eq(users.id, request.user.userId),
        columns: { id: true, role: true, name: true },
      })

      if (!user) return reply.status(401).send({ error: 'Usuário não encontrado' })

      return reply.status(200).send({
        userId: user.id,
        role: user.role,
        name: user.name,
      })
    },
  )

  // POST /auth/logout
  server.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    // LGPD: Art. 6º, X — logout registrado para rastreabilidade de sessões
    await recordAudit(request, reply, {
      userId: request.user.userId,
      action: 'logout',
      resource: 'users',
      legalBasis: 'legitimate_interest',
    })

    reply.clearCookie('token', { path: '/' })
    return reply.status(200).send({ message: 'Logout realizado com sucesso' })
  })
}
