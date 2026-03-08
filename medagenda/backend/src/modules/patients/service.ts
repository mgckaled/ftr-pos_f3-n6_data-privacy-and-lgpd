import { drizzle } from 'drizzle-orm/node-postgres'
import { randomUUID } from 'node:crypto'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import { auditLogs, consents, patientTokens, patients } from '../../db/schema/index.js'
import { encryptField } from '../../lib/pgcrypto.js'
import type { InsertPatientBody } from '@medagenda/shared'

// LGPD: Art. 6º, VIII — prevenção — operação atômica garante consistência dos dados pessoais
// e dos registros de consentimento (Art. 8º, §2º)
export async function createPatientService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  body: InsertPatientBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // LGPD: Art. 6º, VII — RLS ativado na transação; set_config equivale a SET LOCAL
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // LGPD: Art. 5º, I — criação do registro do titular com base legal explícita
    const [patient] = await tx
      .insert(patients)
      .values({
        name: body.name,
        email: body.email || null,
        phone: body.phone || null,
        birthDate: body.birthDate,
        // LGPD: Art. 6º, VII + Art. 46 — CPF criptografado em repouso via pgcrypto (Fase 4)
        // pgp_sym_encrypt com chave de ambiente; prefixo "hQ" identifica dado já cifrado
        cpf: encryptField(body.cpf) as unknown as string,
        legalBasis: body.legalBasis,
        // LGPD: Art. 6º, I — finalidade — 5 anos a partir do cadastro (base: consentimento)
        retentionExpiresAt: new Date(Date.now() + 5 * 365 * 24 * 60 * 60 * 1000),
      })
      .returning()

    // LGPD: Art. 12 — pseudonimização: token substitui patientId nos audit_logs
    const token = randomUUID()
    await tx.insert(patientTokens).values({
      patientId: patient.id,
      token,
    })

    // LGPD: Art. 8º — consentimento por finalidade específica, com prova (ipAddress, policyVersion)
    await tx.insert(consents).values(
      body.consents.map((c) => ({
        patientId: patient.id,
        purpose: c.purpose,
        granted: c.granted,
        ipAddress,
        policyVersion: c.policyVersion,
      })),
    )

    // LGPD: Art. 6º, X — responsabilização — usa patientToken, nunca patientId direto
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'create',
      resource: 'patients',
      patientToken: token,
      legalBasis: body.legalBasis,
      ipAddress,
      metadata: { purposes: body.consents.map((c) => ({ purpose: c.purpose, granted: c.granted })) },
    })

    await client.query('COMMIT')

    return { patient, token }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 6º, III — necessidade — CPF nunca é retornado nas listagens
export async function listPatientsService(actorUserId: string, actorRole: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const result = await tx.query.patients.findMany({
      // LGPD: Art. 6º, III — necessidade — CPF excluído; retorna apenas o mínimo necessário
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        legalBasis: true,
        retentionExpiresAt: true,
        anonymizedAt: true,
        deletedAt: true,
        createdAt: true,
      },
    })

    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

export async function getPatientService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  patientId: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const patient = await tx.query.patients.findFirst({
      where: (p, { eq }) => eq(p.id, patientId),
      // LGPD: Art. 6º, III — necessidade — CPF excluído da resposta
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        birthDate: true,
        legalBasis: true,
        retentionExpiresAt: true,
        anonymizedAt: true,
        deletedAt: true,
        createdAt: true,
      },
    })

    if (!patient) {
      await client.query('ROLLBACK')
      return null
    }

    // LGPD: Art. 12 — recupera token de pseudonimização para uso no audit_log
    const tokenRecord = await tx.query.patientTokens.findFirst({
      where: (pt, { eq }) => eq(pt.patientId, patientId),
      columns: { token: true },
    })

    // LGPD: Art. 6º, X — responsabilização — cada leitura de dados pessoais é registrada
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'read',
      resource: 'patients',
      // LGPD: Art. 12 — pseudonimização: patientToken substitui patientId no log
      patientToken: tokenRecord?.token ?? null,
      legalBasis: patient.legalBasis,
      ipAddress,
    })

    await client.query('COMMIT')
    return patient
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
