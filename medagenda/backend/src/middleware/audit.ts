import type { FastifyReply, FastifyRequest } from 'fastify'
import { db } from '../db/index.js'
import { auditLogs } from '../db/schema/index.js'
import type { NewAuditLog } from '../db/schema/index.js'

// LGPD: Art. 6º, X — responsabilização e prestação de contas
// Toda operação sobre dados pessoais deve ser registrada com base legal
export async function recordAudit(
  request: FastifyRequest,
  _reply: FastifyReply,
  entry: Omit<NewAuditLog, 'ipAddress' | 'userAgent'>,
): Promise<void> {
  await db.insert(auditLogs).values({
    ...entry,
    ipAddress: request.ip,
    userAgent: request.headers['user-agent'],
  })
}
