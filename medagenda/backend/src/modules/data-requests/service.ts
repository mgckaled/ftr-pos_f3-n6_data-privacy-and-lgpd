// LGPD: Art. 18 — serviço de direitos do titular com RLS e audit trail
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import { auditLogs, dataRequests, patientTokens } from '../../db/schema/index.js'
import type {
  CompleteDataRequestBody,
  CreateDataRequestBody,
  DataRequestResponse,
  DenyDataRequestBody,
} from './schema.js'

// LGPD: Art. 18, §5º — SLA de 15 dias corridos a partir da data de solicitação
const SLA_DAYS = 15

/**
 * LGPD: Art. 18, §5º — calcula status do SLA para monitoramento pelo DPO.
 * - ok: concluído/negado, ou mais de 5 dias restantes
 * - warning: 1 a 5 dias restantes
 * - critical: menos de 1 dia ou prazo vencido
 */
function computeSlaStatus(
  deadlineAt: string,
  status: string,
): { slaStatus: DataRequestResponse['slaStatus']; slaRemainingDays: number } {
  const remainingMs = new Date(deadlineAt).getTime() - Date.now()
  const remainingDays = remainingMs / (1000 * 60 * 60 * 24)

  if (status === 'completed' || status === 'denied' || status === 'expired') {
    return { slaStatus: 'ok', slaRemainingDays: Math.round(remainingDays * 100) / 100 }
  }
  if (remainingDays > 5) return { slaStatus: 'ok', slaRemainingDays: Math.round(remainingDays * 100) / 100 }
  if (remainingDays >= 1) return { slaStatus: 'warning', slaRemainingDays: Math.round(remainingDays * 100) / 100 }
  return { slaStatus: 'critical', slaRemainingDays: Math.round(remainingDays * 100) / 100 }
}

function enrichDataRequest(row: typeof dataRequests.$inferSelect): DataRequestResponse {
  const { slaStatus, slaRemainingDays } = computeSlaStatus(String(row.deadlineAt), row.status)
  return {
    id: row.id,
    patientId: row.patientId,
    type: row.type,
    status: row.status,
    reason: row.reason,
    response: row.response,
    processedBy: row.processedBy,
    deadlineAt: String(row.deadlineAt),
    requestedAt: String(row.requestedAt),
    resolvedAt: row.resolvedAt ? String(row.resolvedAt) : null,
    slaStatus,
    slaRemainingDays,
  }
}

// LGPD: Art. 18 — titular cria solicitação formal de exercício de direito
export async function createDataRequestService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  body: CreateDataRequestBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // LGPD: Art. 18 — patient conhece userId (do JWT), não patientId — lookup necessário
    const patientRecord = await tx.query.patients.findFirst({
      where: (p, { eq: eqFn }) => eqFn(p.userId, actorUserId),
      columns: { id: true },
    })

    if (!patientRecord) {
      throw new Error('Paciente não encontrado para este usuário')
    }

    // LGPD: Art. 18, §5º — SLA de 15 dias corridos
    const deadlineAt = new Date(Date.now() + SLA_DAYS * 24 * 60 * 60 * 1000)

    const [dataRequest] = await tx
      .insert(dataRequests)
      .values({
        patientId: patientRecord.id,
        type: body.type,
        reason: body.reason ?? null,
        deadlineAt,
      })
      .returning()

    // LGPD: Art. 5º, XI — pseudonimização — audit log usa patientToken, nunca patientId
    const tokenRow = await tx.query.patientTokens.findFirst({
      where: (pt, { eq: eqFn }) => eqFn(pt.patientId, patientRecord.id),
    })

    // LGPD: Art. 6º, X — responsabilização — registra exercício de direito do titular
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'data_request',
      resource: 'data_requests',
      resourceId: dataRequest.id,
      patientToken: tokenRow?.token ?? null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: { type: body.type },
    })

    await client.query('COMMIT')
    return enrichDataRequest(dataRequest)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18 — listagem com RLS ativo: admin vê tudo, patient vê apenas as próprias
export async function listDataRequestsService(actorUserId: string, actorRole: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })
    const rows = await tx.query.dataRequests.findMany({
      orderBy: (dr, { desc }) => [desc(dr.requestedAt)],
    })

    await client.query('COMMIT')

    const enriched = rows.map(enrichDataRequest)
    const pendingCount = enriched.filter((r) => r.status === 'pending' || r.status === 'in_progress').length
    const overdueCount = enriched.filter((r) => r.slaStatus === 'critical' && r.status !== 'completed' && r.status !== 'denied').length

    return { dataRequests: enriched, total: enriched.length, pendingCount, overdueCount }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18 — detalhe individual de solicitação
export async function getDataRequestService(
  actorUserId: string,
  actorRole: string,
  requestId: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })
    const row = await tx.query.dataRequests.findFirst({
      where: (dr, { eq: eqFn }) => eqFn(dr.id, requestId),
    })

    await client.query('COMMIT')
    return row ? enrichDataRequest(row) : null
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18, §3º — admin responde formalmente ao titular e marca como concluída
export async function completeDataRequestService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  requestId: string,
  body: CompleteDataRequestBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const existing = await tx.query.dataRequests.findFirst({
      where: (dr, { eq: eqFn }) => eqFn(dr.id, requestId),
    })

    if (!existing) {
      await client.query('ROLLBACK')
      return null
    }

    const now = new Date()
    const [updated] = await tx
      .update(dataRequests)
      .set({
        status: 'completed',
        response: body.response,
        processedBy: actorUserId,
        resolvedAt: now,
      })
      .where(eq(dataRequests.id, requestId))
      .returning()

    // LGPD: Art. 6º, X — responsabilização — auditoria da conclusão
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'update',
      resource: 'data_requests',
      resourceId: requestId,
      patientToken: null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: { event: 'completed', type: existing.type },
    })

    await client.query('COMMIT')
    return enrichDataRequest(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 18 — admin nega solicitação com justificativa formal obrigatória
export async function denyDataRequestService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  requestId: string,
  body: DenyDataRequestBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const existing = await tx.query.dataRequests.findFirst({
      where: (dr, { eq: eqFn }) => eqFn(dr.id, requestId),
    })

    if (!existing) {
      await client.query('ROLLBACK')
      return null
    }

    const now = new Date()
    const [updated] = await tx
      .update(dataRequests)
      .set({
        status: 'denied',
        response: body.response,
        processedBy: actorUserId,
        resolvedAt: now,
      })
      .where(eq(dataRequests.id, requestId))
      .returning()

    // LGPD: Art. 6º, X — responsabilização — auditoria da negação com justificativa
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'update',
      resource: 'data_requests',
      resourceId: requestId,
      patientToken: null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: { event: 'denied', type: existing.type },
    })

    await client.query('COMMIT')
    return enrichDataRequest(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

