import { drizzle } from 'drizzle-orm/node-postgres'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import { auditLogs, medicalRecords, patientTokens } from '../../db/schema/index.js'
import type { InsertMedicalRecordBody } from '../appointments/schema.js'

// Retenção obrigatória de 20 anos para prontuários (CFM nº 1.821/2007)
const RETENTION_YEARS = 20

function retentionDate(): Date {
  return new Date(Date.now() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000)
}

// LGPD: Art. 11 — tratamento de dados sensíveis de saúde com base legal específica
// LGPD: Art. 6º, VIII — prevenção — operação atômica garante consistência
export async function createMedicalRecordService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  body: InsertMedicalRecordBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // LGPD: Art. 6º, VII — RLS ativado no escopo da transação
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // Recupera o patientId a partir do agendamento para manter vínculo
    const appointment = await tx.query.appointments.findFirst({
      where: (a, { eq }) => eq(a.id, body.appointmentId),
      columns: { patientId: true },
    })

    if (!appointment) {
      await client.query('ROLLBACK')
      throw new Error('Agendamento não encontrado')
    }

    // LGPD: Art. 11 — dado sensível de saúde inserido no schema 'private'
    // LGPD: Art. 6º, I — finalidade — retenção 20 anos por obrigação legal (CFM)
    const [record] = await tx
      .insert(medicalRecords)
      .values({
        appointmentId: body.appointmentId,
        patientId: appointment.patientId,
        doctorId: actorUserId,
        diagnosis: body.diagnosis ?? null,
        prescription: body.prescription ?? null,
        clinicalNotes: body.clinicalNotes ?? null,
        icdCode: body.icdCode ?? null,
        sensitiveLegalBasis: body.sensitiveLegalBasis,
        retentionExpiresAt: retentionDate(),
      })
      .returning()

    // LGPD: Art. 12 — recupera token de pseudonimização para audit_log
    const tokenRecord = await tx.query.patientTokens.findFirst({
      where: (pt, { eq }) => eq(pt.patientId, appointment.patientId),
      columns: { token: true },
    })

    // LGPD: Art. 6º, X — responsabilização — criação de dado sensível registrada com patientToken
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'create',
      resource: 'medical_records',
      resourceId: record.id,
      // LGPD: Art. 12 — pseudonimização: token substitui patientId no log
      patientToken: tokenRecord?.token ?? null,
      // LGPD: Art. 11, II, f — base legal para dado sensível de saúde
      legalBasis: 'health_care',
      ipAddress,
    })

    await client.query('COMMIT')
    return record
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 6º, X — cada leitura de dado sensível registrada em audit_logs
// LGPD: Art. 5º, II — dados sensíveis nunca ficam em cache ou estado global
export async function getMedicalRecordService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  appointmentId: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const record = await tx.query.medicalRecords.findFirst({
      where: (mr, { eq }) => eq(mr.appointmentId, appointmentId),
    })

    if (!record) {
      await client.query('ROLLBACK')
      return null
    }

    // LGPD: Art. 12 — recupera token de pseudonimização
    const tokenRecord = await tx.query.patientTokens.findFirst({
      where: (pt, { eq }) => eq(pt.patientId, record.patientId),
      columns: { token: true },
    })

    // LGPD: Art. 6º, X — leitura de dado sensível registrada
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'read',
      resource: 'medical_records',
      resourceId: record.id,
      patientToken: tokenRecord?.token ?? null,
      legalBasis: 'health_care',
      ipAddress,
    })

    await client.query('COMMIT')
    return record
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
