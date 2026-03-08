// LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — gerenciamento de incidentes de segurança
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import { auditLogs, incidents } from '../../db/schema/index.js'
import type { InsertIncidentBody, IncidentResponse } from './schema.js'

// Resolução CD/ANPD nº 15/2024 — prazo máximo de 72h para notificação preliminar à ANPD
const ANPD_DEADLINE_HOURS = 72
// Janela de alerta: menos de 12h restantes dispara status 'urgent'
const ALERT_THRESHOLD_HOURS = 12

/**
 * LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — calcula status do prazo de notificação.
 * - compliant: já notificado à ANPD
 * - pending: não notificado, mais de 12h restantes
 * - urgent: não notificado, menos de 12h restantes
 * - overdue: não notificado, prazo de 72h vencido
 */
function computeAnpdAlert(
  detectedAt: string,
  notifiedAnpdAt: string | null,
): { anpdAlertStatus: IncidentResponse['anpdAlertStatus']; anpdDeadlineRemainingHours: number } {
  const deadlineMs = new Date(detectedAt).getTime() + ANPD_DEADLINE_HOURS * 60 * 60 * 1000
  const remainingMs = deadlineMs - Date.now()
  const remainingHours = remainingMs / (60 * 60 * 1000)

  if (notifiedAnpdAt) {
    return { anpdAlertStatus: 'compliant', anpdDeadlineRemainingHours: remainingHours }
  }
  if (remainingMs < 0) {
    return { anpdAlertStatus: 'overdue', anpdDeadlineRemainingHours: remainingHours }
  }
  if (remainingHours < ALERT_THRESHOLD_HOURS) {
    return { anpdAlertStatus: 'urgent', anpdDeadlineRemainingHours: remainingHours }
  }
  return { anpdAlertStatus: 'pending', anpdDeadlineRemainingHours: remainingHours }
}

function enrichIncident(incident: typeof incidents.$inferSelect): IncidentResponse {
  const { anpdAlertStatus, anpdDeadlineRemainingHours } = computeAnpdAlert(
    String(incident.detectedAt),
    incident.notifiedAnpdAt ? String(incident.notifiedAnpdAt) : null,
  )
  return {
    id: incident.id,
    title: incident.title,
    description: incident.description,
    severity: incident.severity,
    status: incident.status,
    detectedAt: String(incident.detectedAt),
    notifiedAnpdAt: incident.notifiedAnpdAt ? String(incident.notifiedAnpdAt) : null,
    anpdAlertStatus,
    anpdDeadlineRemainingHours: Math.round(anpdDeadlineRemainingHours * 100) / 100,
    affectedCount: incident.affectedCount,
    affectedResources: incident.affectedResources,
    containmentMeasures: incident.containmentMeasures,
    reportedBy: incident.reportedBy,
    createdAt: String(incident.createdAt),
    updatedAt: String(incident.updatedAt),
  }
}

// LGPD: Art. 48 — registro formal de incidente de segurança com audit trail
export async function createIncidentService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  body: InsertIncidentBody,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // LGPD: Art. 48 — inserção do incidente com todos os campos exigidos pela Resolução CD/ANPD
    const [incident] = await tx
      .insert(incidents)
      .values({
        title: body.title,
        description: body.description ?? null,
        severity: body.severity,
        detectedAt: new Date(body.detectedAt),
        affectedCount: body.affectedCount ?? null,
        affectedResources: body.affectedResources ?? null,
        containmentMeasures: body.containmentMeasures ?? null,
        reportedBy: actorUserId,
      })
      .returning()

    // LGPD: Art. 6º, X — responsabilização — registro do incidente auditado
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'incident_report',
      resource: 'incidents',
      resourceId: incident.id,
      // LGPD: Art. 48 — incidente registrado sem expor patientId diretamente
      patientToken: null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: {
        severity: body.severity,
        affectedCount: body.affectedCount ?? null,
        affectedResources: body.affectedResources ?? null,
      },
    })

    await client.query('COMMIT')
    return enrichIncident(incident)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 48 — listagem de incidentes com status de prazo calculado em tempo real
export async function listIncidentsService(actorUserId: string, actorRole: string) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })
    const rows = await tx.query.incidents.findMany({
      orderBy: (i, { desc }) => [desc(i.createdAt)],
    })

    await client.query('COMMIT')

    const enriched = rows.map(enrichIncident)
    const urgentCount = enriched.filter(
      (i) => i.anpdAlertStatus === 'urgent' || i.anpdAlertStatus === 'overdue',
    ).length

    return { incidents: enriched, total: enriched.length, urgentCount }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 48 — detalhe de incidente individual com status do prazo
export async function getIncidentService(
  actorUserId: string,
  actorRole: string,
  incidentId: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })
    const incident = await tx.query.incidents.findFirst({
      where: (i, { eq: eqFn }) => eqFn(i.id, incidentId),
    })

    await client.query('COMMIT')
    return incident ? enrichIncident(incident) : null
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — registra notificação formal à ANPD
// Atualiza status para 'notified' e persiste timestamp como prova do cumprimento do prazo
export async function notifyAnpdService(
  actorUserId: string,
  actorRole: string,
  ipAddress: string,
  incidentId: string,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const existing = await tx.query.incidents.findFirst({
      where: (i, { eq: eqFn }) => eqFn(i.id, incidentId),
    })

    if (!existing) {
      await client.query('ROLLBACK')
      return null
    }

    if (existing.notifiedAnpdAt) {
      await client.query('ROLLBACK')
      // Já notificado — retorna o estado atual sem erro
      return enrichIncident(existing)
    }

    const now = new Date()
    const [updated] = await tx
      .update(incidents)
      .set({
        notifiedAnpdAt: now,
        status: 'notified',
        updatedAt: now,
      })
      .where(eq(incidents.id, incidentId))
      .returning()

    // LGPD: Art. 6º, X + Art. 48 — auditoria da notificação à ANPD
    await tx.insert(auditLogs).values({
      userId: actorUserId,
      action: 'incident_report',
      resource: 'incidents',
      resourceId: incidentId,
      patientToken: null,
      legalBasis: 'legal_obligation',
      ipAddress,
      metadata: {
        event: 'anpd_notified',
        notifiedAt: now.toISOString(),
      },
    })

    await client.query('COMMIT')
    return enrichIncident(updated)
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
