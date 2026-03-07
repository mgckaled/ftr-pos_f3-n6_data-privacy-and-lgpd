import 'dotenv/config'
import {
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import { authPlugin } from './modules/auth/plugin.js'

const app = Fastify({ logger: true })

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(fastifyCookie)
await app.register(fastifyCors, {
  // LGPD: Art. 6º, VII — origem explícita evita CSRF e acesso não autorizado
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
})

await app.register(authPlugin, { prefix: '/auth' })

app.get('/health', async () => ({ status: 'ok' }))

try {
  await app.listen({ port: 3000, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
