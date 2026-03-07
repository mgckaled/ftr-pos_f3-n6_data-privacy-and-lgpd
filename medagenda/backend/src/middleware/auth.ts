import type { FastifyReply, FastifyRequest } from 'fastify'
import { verifyJWT } from '../lib/jwt.js'

declare module 'fastify' {
  interface FastifyRequest {
    user: { userId: string; role: string }
  }
}

// LGPD: Art. 6º, VII — segurança — toda requisição a dados pessoais exige identidade verificada
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const token = request.cookies['token']

  if (!token) {
    return reply.status(401).send({ error: 'Não autenticado' })
  }

  try {
    const payload = await verifyJWT(token)
    request.user = { userId: payload.sub, role: payload.role }
  } catch {
    return reply.status(401).send({ error: 'Token inválido ou expirado' })
  }
}
