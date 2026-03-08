import 'dotenv/config'
import {
  serializerCompiler,
  validatorCompiler,
  jsonSchemaTransform,
} from 'fastify-type-provider-zod'
import Fastify from 'fastify'
import fastifyCookie from '@fastify/cookie'
import fastifyCors from '@fastify/cors'
import fastifySwagger from '@fastify/swagger'
import scalarApiReference from '@scalar/fastify-api-reference'
import { authPlugin } from './modules/auth/plugin.js'
import { patientsPlugin } from './modules/patients/plugin.js'
import { appointmentsPlugin } from './modules/appointments/plugin.js'
import { medicalRecordsPlugin } from './modules/medical-records/plugin.js'
import { scheduleRetentionCleanup } from './jobs/retention-cleanup.js'

const app = Fastify({ logger: true })

app.setValidatorCompiler(validatorCompiler)
app.setSerializerCompiler(serializerCompiler)

await app.register(fastifyCookie)
await app.register(fastifyCors, {
  // LGPD: Art. 6º, VII — origem explícita evita CSRF e acesso não autorizado
  origin: process.env.FRONTEND_URL ?? 'http://localhost:5173',
  credentials: true,
})

// LGPD: Art. 6º, X — documentação OpenAPI como evidência de conformidade
// Registrar ANTES dos plugins de rotas — o @fastify/swagger coleta schemas durante o registro
// Spec JSON disponível em GET /documentation/json (verificar este endpoint se /reference abrir em branco)
await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'MedAgenda API',
      description:
        'Sistema de agendamento médico — conformidade LGPD (Lei nº 13.709/2018). ' +
        'Todos os endpoints implementam base legal explícita (Art. 7º e Art. 11).',
      version: '3.0.0',
    },
    tags: [
      { name: 'auth', description: 'Autenticação e sessão (Art. 6º, X)' },
      { name: 'patients', description: 'Titulares dos dados pessoais (Art. 5º, I)' },
      { name: 'appointments', description: 'Agendamentos — retenção 20 anos (CFM nº 1.821/2007)' },
      { name: 'medical-records', description: 'Prontuários — dados sensíveis de saúde (Art. 5º, II e Art. 11)' },
    ],
    components: {
      securitySchemes: {
        // LGPD: Art. 6º, VII — token em httpOnly cookie, nunca em header Authorization
        cookieAuth: { type: 'apiKey', in: 'cookie', name: 'token' },
      },
    },
  },
  transform: jsonSchemaTransform,
})

// Scalar UI em /reference
// IMPORTANTE: se a UI abrir em branco, acessar /documentation/json primeiro para confirmar que o spec está sendo gerado
await app.register(scalarApiReference, {
  routePrefix: '/reference',
  configuration: { url: '/documentation/json' },
})

await app.register(authPlugin, { prefix: '/auth' })
await app.register(patientsPlugin, { prefix: '/patients' })
await app.register(appointmentsPlugin, { prefix: '/appointments' })
await app.register(medicalRecordsPlugin, { prefix: '/medical-records' })

app.get('/health', async () => ({ status: 'ok' }))

try {
  await app.listen({ port: 3000, host: '0.0.0.0' })

  // LGPD: Art. 6º, I — finalidade — job de retenção garante cumprimento das políticas de ciclo de vida
  scheduleRetentionCleanup()
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
