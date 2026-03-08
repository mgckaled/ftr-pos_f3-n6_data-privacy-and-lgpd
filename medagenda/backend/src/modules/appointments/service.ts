import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, isNull, lt, ne } from 'drizzle-orm'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import {
  appointments,
  appointmentStats,
  auditLogs,
  patientTokens,
} from '../../db/schema/index.js'
import type { InsertAppointmentBody } from '@medagenda/shared'

// Retenção obrigatória de 20 anos para prontuários e agendamentos (CFM nº 1.821/2007)
const RETENTION_YEARS = 20

function retentionDate(): Date {
  return new Date(Date.now() + RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000)
}

// LGPD: Art. 6º, VIII — prevenção — operação atômica garante consistência do agendamento
export async function createAppointmentService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  body: InsertAppointmentBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // LGPD: Art. 6º, VII — RLS ativado no escopo da transação
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // LGPD: Art. 6º, I — finalidade — retenção 20 anos por obrigação legal (CFM)
    const [appointment] = await tx
      .insert(appointments)
      .values({
        patientId: body.patientId,
        doctorId: body.doctorId,
        // Converte string ISO 8601 para Date — tipo esperado pela coluna timestamp do Drizzle
        scheduledAt: new Date(body.scheduledAt),
        notes: body.notes ?? null,
        retentionExpiresAt: retentionDate(),
      })
      .returning()

    // LGPD: Art. 12 — recupera token de pseudonimização para audit_log
    const tokenRecord = await tx.query.patientTokens.findFirst({
      where: (pt, { eq }) => eq(pt.patientId, body.patientId),
      columns: { token: true },
    })

    // LGPD: Art. 6º, X — responsabilização — cada criação registrada com patientToken
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'create',
      resource: 'appointments',
      resourceId: appointment.id,
      // LGPD: Art. 12 — pseudonimização: token substitui patientId no log
      patientToken: tokenRecord?.token ?? null,
      // LGPD: Art. 11, II, f — base legal: atenção à saúde
      legalBasis: 'health_care',
      ipAddress,
    })

    await client.query('COMMIT')
    return { id: appointment.id }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 6º, III — necessidade — retorna apenas colunas necessárias, sem dados do prontuário
export async function listAppointmentsService(actorUserId: string, actorRole: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const result = await tx.query.appointments.findMany({
      // LGPD: Art. 6º, III — necessidade — apenas campos operacionais
      columns: {
        id: true,
        patientId: true,
        doctorId: true,
        scheduledAt: true,
        status: true,
        notes: true,
        retentionExpiresAt: true,
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

// LGPD: Art. 6º, X — cada leitura de agendamento gera entrada em audit_logs
export async function getAppointmentService(
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

    const appointment = await tx.query.appointments.findFirst({
      where: (a, { eq }) => eq(a.id, appointmentId),
      columns: {
        id: true,
        patientId: true,
        doctorId: true,
        scheduledAt: true,
        status: true,
        notes: true,
        retentionExpiresAt: true,
        deletedAt: true,
        createdAt: true,
      },
    })

    if (!appointment) {
      await client.query('ROLLBACK')
      return null
    }

    // LGPD: Art. 12 — recupera token de pseudonimização
    const tokenRecord = await tx.query.patientTokens.findFirst({
      where: (pt, { eq }) => eq(pt.patientId, appointment.patientId),
      columns: { token: true },
    })

    // LGPD: Art. 6º, X — responsabilização — leitura registrada com patientToken
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'read',
      resource: 'appointments',
      resourceId: appointmentId,
      patientToken: tokenRecord?.token ?? null,
      legalBasis: 'health_care',
      ipAddress,
    })

    await client.query('COMMIT')
    return appointment
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 5º, XIV — cancelamento é soft delete: preserva retenção obrigatória (CFM)
export async function cancelAppointmentService(
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

    const [updated] = await tx
      .update(appointments)
      .set({ status: 'cancelled', deletedAt: new Date(), updatedAt: new Date() })
      // LGPD: Art. 5º, XIV — só cancela se ainda não cancelado (idempotência segura)
      .where(and(eq(appointments.id, appointmentId), ne(appointments.status, 'cancelled')))
      .returning({ id: appointments.id, patientId: appointments.patientId })

    if (!updated) {
      await client.query('ROLLBACK')
      return null
    }

    const tokenRecord = await tx.query.patientTokens.findFirst({
      where: (pt, { eq }) => eq(pt.patientId, updated.patientId),
      columns: { token: true },
    })

    // LGPD: Art. 6º, X — responsabilização — cancelamento registrado em audit_logs
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'update',
      resource: 'appointments',
      resourceId: appointmentId,
      patientToken: tokenRecord?.token ?? null,
      legalBasis: 'health_care',
      ipAddress,
      metadata: { action: 'cancel' },
    })

    await client.query('COMMIT')
    return { id: updated.id }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 5º, XI — estatísticas anonimizadas: sem identificadores pessoais
// Refresh da view materializada antes da leitura garante dados atualizados
export async function getAppointmentStatsService(actorUserId: string, actorRole: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // LGPD: Art. 5º, XI — refresh garante que a view não exponha dados individuais desatualizados
    await tx.refreshMaterializedView(appointmentStats)

    const stats = await tx.select().from(appointmentStats)

    await client.query('COMMIT')
    return stats
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
