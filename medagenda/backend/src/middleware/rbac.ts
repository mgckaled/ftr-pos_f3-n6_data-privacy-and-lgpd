import type { FastifyReply, FastifyRequest } from 'fastify'
import { db } from '../db/index.js'
import { auditLogs } from '../db/schema/index.js'

type Role = 'admin' | 'doctor' | 'receptionist' | 'patient'

// LGPD: Art. 6º, VII — segurança — acesso a dados pessoais restrito por papel (RBAC)
export function requireRole(...roles: Role[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId, role } = request.user

    if (!roles.includes(role as Role)) {
      // LGPD: Art. 6º, X — responsabilização — tentativas de acesso não autorizado são registradas
      await db.insert(auditLogs).values({
        userId,
        action: 'read',
        resource: request.routeOptions?.url ?? request.url,
        legalBasis: null,
        ipAddress: request.ip,
        userAgent: request.headers['user-agent'],
        metadata: { denied: true, requiredRoles: roles, actualRole: role },
      })

      return reply.status(403).send({ error: 'Acesso negado' })
    }
  }
}
