import bcrypt from 'bcryptjs'
import { eq } from 'drizzle-orm'
import { db } from '../../db/index.js'
import { users } from '../../db/schema/index.js'
import { signJWT } from '../../lib/jwt.js'

export async function loginService(email: string, password: string) {
  // LGPD: Art. 6º, VII — segurança — busca por email sem expor dados de outros usuários
  const user = await db.query.users.findFirst({
    where: eq(users.email, email),
  })

  // Tempo constante na comparação evita timing attacks (inferência de existência de email)
  const dummyHash =
    '$2a$12$dummy.hash.to.prevent.timing.attack.on.nonexistent.user'
  const passwordHash = user?.passwordHash ?? dummyHash

  const valid = await bcrypt.compare(password, passwordHash)

  if (!user || !valid || user.deletedAt) {
    return null
  }

  // LGPD: Art. 6º, VII — JWT com expiração de 1h; payload mínimo necessário (princípio da necessidade)
  const token = await signJWT({ sub: user.id, role: user.role })

  return { token, user: { userId: user.id, role: user.role, name: user.name } }
}
