import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { db, pool } from './index.js'
import { users } from './schema/index.js'

// LGPD: Art. 6º, VII — senhas de seed hasheadas com bcrypt (rounds: 12)
// Nunca armazenar senhas em texto claro, mesmo em ambiente de desenvolvimento
const SALT_ROUNDS = 12

const seedUsers = [
  {
    name: 'Admin MedAgenda',
    email: 'admin@medagenda.dev',
    password: 'Admin@123',
    role: 'admin' as const,
  },
  {
    name: 'Dr. João Silva',
    email: 'doctor@medagenda.dev',
    password: 'Doctor@123',
    role: 'doctor' as const,
  },
  {
    name: 'Ana Recepcionista',
    email: 'recep@medagenda.dev',
    password: 'Recep@123',
    role: 'receptionist' as const,
  },
  {
    name: 'Maria Paciente',
    email: 'patient@medagenda.dev',
    password: 'Patient@123',
    role: 'patient' as const,
  },
]

async function seed() {
  console.log('Iniciando seed...')

  for (const seedUser of seedUsers) {
    const passwordHash = await bcrypt.hash(seedUser.password, SALT_ROUNDS)

    await db
      .insert(users)
      .values({
        name: seedUser.name,
        email: seedUser.email,
        passwordHash,
        role: seedUser.role,
      })
      .onConflictDoNothing({ target: users.email })

    console.log(`Usuário criado: ${seedUser.email} (${seedUser.role})`)
  }

  console.log('Seed concluído.')
  await pool.end()
}

seed().catch((err) => {
  console.error('Erro no seed:', err)
  process.exit(1)
})
