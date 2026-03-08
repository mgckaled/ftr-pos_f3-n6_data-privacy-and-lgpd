import cron from 'node-cron'
import { and, isNotNull, isNull, lt, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { appointments, auditLogs, patients } from '../db/schema/index.js'

// LGPD: Art. 5º, XIV — distinção explícita entre os três estados:
// 1. Soft delete: registro com deletedAt preenchido — acesso bloqueado, dado preservado para retenção
// 2. Eliminação real (hard delete): DELETE SQL — executado APENAS após esgotamento do prazo de retenção
// 3. Anonimização: UPDATE com campos pessoais removidos — linha preservada para integridade referencial

async function runRetentionCleanup(): Promise<void> {
  const now = new Date()

  // ---- 1. ELIMINAÇÃO REAL de agendamentos ----
  // LGPD: Art. 5º, XIV — hard delete SOMENTE após soft delete E vencimento de retentionExpiresAt
  // Obrigação CFM nº 1.821/2007: retenção de 20 anos; só elimina após esse prazo
  const deletedAppointments = await db
    .delete(appointments)
    .where(
      and(
        isNotNull(appointments.deletedAt),          // já passou por soft delete
        lt(appointments.retentionExpiresAt, now),   // prazo de retenção vencido
      ),
    )
    .returning({ id: appointments.id })

  if (deletedAppointments.length > 0) {
    // LGPD: Art. 6º, X — eliminação registrada em audit_log (sem patientToken — dados já eliminados)
    await db.insert(auditLogs).values({
      action: 'delete',
      resource: 'appointments',
      legalBasis: 'legal_obligation',
      metadata: {
        reason: 'retention_expired',
        // LGPD: Art. 5º, XIV — distinção explícita: hardDelete = eliminação real permanente
        hardDelete: true,
        count: deletedAppointments.length,
        processedAt: now.toISOString(),
      },
    })
  }

  // ---- 2. ELIMINAÇÃO REAL de pacientes (base: legal_obligation) ----
  // LGPD: Art. 5º, XIV — hard delete SOMENTE após soft delete E vencimento de retenção
  const deletedPatients = await db
    .delete(patients)
    .where(
      and(
        isNotNull(patients.deletedAt),            // já passou por soft delete
        lt(patients.retentionExpiresAt, now),     // prazo de retenção vencido
      ),
    )
    .returning({ id: patients.id })

  if (deletedPatients.length > 0) {
    // LGPD: Art. 6º, X — eliminação de dados pessoais registrada
    await db.insert(auditLogs).values({
      action: 'delete',
      resource: 'patients',
      legalBasis: 'legal_obligation',
      metadata: {
        reason: 'retention_expired',
        // LGPD: Art. 5º, XIV — distinção explícita: hardDelete = eliminação real permanente
        hardDelete: true,
        count: deletedPatients.length,
        processedAt: now.toISOString(),
      },
    })
  }

  // ---- 3. ANONIMIZAÇÃO de pacientes com retenção vencida (sem soft delete prévio) ----
  // LGPD: Art. 5º, XI — anonimização: elimina identificação direta, preserva linha para integridade
  // Diferente de hard delete: a linha permanece, mas sem qualquer dado pessoal identificável
  const anonymizedPatients = await db
    .update(patients)
    .set({
      // LGPD: Art. 5º, XI — campos pessoais substituídos por valor indicativo de anonimização
      name: '[anonimizado]',
      email: null,
      phone: null,
      cpf: '[anonimizado]',
      // LGPD: Art. 5º, XI — timestamp registra o momento da anonimização para rastreabilidade
      anonymizedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        isNull(patients.deletedAt),              // não foi soft deleted (anonimiza ao invés de deletar)
        isNull(patients.anonymizedAt),           // ainda não foi anonimizado
        lt(patients.retentionExpiresAt, now),    // prazo de retenção vencido
      ),
    )
    .returning({ id: patients.id })

  if (anonymizedPatients.length > 0) {
    // LGPD: Art. 6º, X — anonimização registrada em audit_log
    await db.insert(auditLogs).values({
      action: 'delete',
      resource: 'patients',
      legalBasis: 'legal_obligation',
      metadata: {
        reason: 'retention_expired',
        // LGPD: Art. 5º, XI — distinção explícita: anonymized = anonimização (não eliminação)
        anonymized: true,
        hardDelete: false,
        count: anonymizedPatients.length,
        processedAt: now.toISOString(),
      },
    })
  }

  const total = deletedAppointments.length + deletedPatients.length + anonymizedPatients.length

  if (total > 0) {
    console.log(
      `[retention-cleanup] ${now.toISOString()} — processados: ` +
      `${deletedAppointments.length} agendamentos eliminados, ` +
      `${deletedPatients.length} pacientes eliminados, ` +
      `${anonymizedPatients.length} pacientes anonimizados`,
    )
  }
}

// LGPD: Art. 6º, I — finalidade — limpeza automática garante cumprimento das políticas de retenção
// Schedule: diário às 02h00 — janela de baixo tráfego para minimizar impacto operacional
export function scheduleRetentionCleanup(): void {
  const SCHEDULE = '0 2 * * *'

  cron.schedule(SCHEDULE, () => {
    runRetentionCleanup().catch((err) => {
      console.error('[retention-cleanup] Erro durante execução:', err)
    })
  })

  console.log(`[retention-cleanup] job agendado: ${SCHEDULE}`)
}
