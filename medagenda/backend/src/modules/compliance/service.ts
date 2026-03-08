// LGPD: Art. 37 (ROPA) + Art. 6º, X (conformidade) — serviço de compliance para o DPO
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql, desc } from 'drizzle-orm'
import { pool } from '../../db/index.js'
import * as schema from '../../db/schema/index.js'
import { auditLogs } from '../../db/schema/index.js'
import type { RopaResponse, ComplianceReport } from './schema.js'

// LGPD: Art. 37 — atividades de tratamento estáticas com enriquecimento dinâmico dos audit_logs
const ROPA_STATIC_ACTIVITIES = [
  {
    activityName: 'Autenticação e controle de acesso',
    purpose: 'Verificação de identidade e controle de acesso ao sistema',
    legalBasis: 'Art. 7º, II — execução de contrato',
    dataCategories: ['e-mail', 'senha (hash bcrypt)', 'role de acesso'],
    dataSubjects: 'Todos os usuários (admin, médico, recepcionista, paciente)',
    recipients: 'Nenhum — dados não compartilhados externamente',
    retentionPeriod: 'Enquanto a conta estiver ativa; 30 dias após encerramento',
    technicalMeasures: [
      'JWT com expiração de 1h (httpOnly cookie)',
      'Hash bcrypt de senhas',
      'RLS por role (admin, doctor, receptionist, patient)',
      'Audit log de login/logout',
    ],
    resourceKey: 'users',
    actionKey: null,
  },
  {
    activityName: 'Cadastro e tratamento de dados de pacientes',
    purpose: 'Registro de titulares para prestação de serviços de saúde',
    legalBasis: 'Art. 7º, II — execução de contrato; Art. 7º, I — consentimento',
    dataCategories: ['nome', 'e-mail', 'telefone', 'data de nascimento', 'CPF (criptografado)'],
    dataSubjects: 'Pacientes (titulares dos dados)',
    recipients: 'Médicos (acesso restrito para fins de saúde)',
    retentionPeriod: '5 anos (base consentimento) ou conforme obrigação legal',
    technicalMeasures: [
      'CPF criptografado via pgp_sym_encrypt (pgcrypto)',
      'RLS diferenciado por role',
      'Pseudonimização via patient_tokens nos audit_logs',
      'Soft delete antes de hard delete (ciclo de vida)',
    ],
    resourceKey: 'patients',
    actionKey: null,
  },
  {
    activityName: 'Agendamento de consultas médicas',
    purpose: 'Gestão operacional de consultas para atenção à saúde',
    legalBasis: 'Art. 7º, II — execução de contrato; Art. 11, II, f — saúde',
    dataCategories: ['referência ao paciente', 'referência ao médico', 'data/hora', 'observações'],
    dataSubjects: 'Pacientes e médicos',
    recipients: 'Médicos (acesso via RLS por doctorId)',
    retentionPeriod: '20 anos (CFM nº 1.821/2007 — obrigação legal)',
    technicalMeasures: [
      'RLS: médico acessa apenas próprios agendamentos',
      'retentionExpiresAt = 20 anos',
      'Soft delete + hard delete por job diário (2h)',
      'View materializada de estatísticas anonimizadas',
    ],
    resourceKey: 'appointments',
    actionKey: null,
  },
  {
    activityName: 'Tratamento de dados sensíveis de saúde (prontuários)',
    purpose: 'Documentação clínica para continuidade do cuidado',
    legalBasis: 'Art. 11, II, f — proteção da saúde pelo profissional de saúde',
    dataCategories: ['diagnóstico (CID)', 'prescrição', 'notas clínicas', 'código CID'],
    dataSubjects: 'Pacientes',
    recipients: 'Apenas o médico responsável (RLS por doctorId)',
    retentionPeriod: '20 anos (CFM nº 1.821/2007 — obrigação legal)',
    technicalMeasures: [
      'Schema PostgreSQL isolado (private.*)',
      'Criptografia em repouso: pgp_sym_encrypt para todos os campos sensíveis',
      'RLS: apenas médico responsável acessa; admin somente leitura',
      'Dados jamais armazenados em estado global no frontend',
    ],
    resourceKey: 'medical_records',
    actionKey: null,
  },
  {
    activityName: 'Gestão de consentimentos por finalidade',
    purpose: 'Registro e rastreabilidade de consentimentos específicos por finalidade',
    legalBasis: 'Art. 7º, I — consentimento; Art. 8º, §2º — ônus da prova',
    dataCategories: ['finalidade', 'status (concedido/revogado)', 'data', 'IP', 'versão da política'],
    dataSubjects: 'Pacientes (titulares)',
    recipients: 'Nenhum — registro interno de conformidade',
    retentionPeriod: 'Indefinido — evidência de conformidade (Art. 8º, §2º)',
    technicalMeasures: [
      'Consentimento específico por finalidade (nunca genérico)',
      'Imutabilidade: revogação gera novo registro (revokedAt), nunca edita o original',
      'IP e versão da política como prova demonstrável',
      'Nenhum checkbox pré-marcado no frontend',
    ],
    resourceKey: null,
    actionKey: 'consent_grant',
  },
  {
    activityName: 'Notificação de incidentes de segurança',
    purpose: 'Comunicação de incidentes que possam acarretar risco aos titulares',
    legalBasis: 'Art. 48 + Resolução CD/ANPD nº 15/2024 — obrigação legal',
    dataCategories: ['título', 'descrição', 'severidade', 'afetados', 'medidas de contenção'],
    dataSubjects: 'Titulares potencialmente afetados',
    recipients: 'ANPD (Autoridade Nacional de Proteção de Dados)',
    retentionPeriod: 'Indefinido — evidência de conformidade regulatória',
    technicalMeasures: [
      'Prazo de 72h monitorado com alertas automáticos',
      'anpdAlertStatus: compliant | pending | urgent | overdue',
      'notifiedAnpdAt como timestamp imutável de prova',
    ],
    resourceKey: 'incidents',
    actionKey: null,
  },
  {
    activityName: 'Exercício de direitos do titular',
    purpose: 'Atendimento formal às solicitações de direitos do Art. 18 da LGPD',
    legalBasis: 'Art. 18 — direito do titular; Art. 6º, X — responsabilização',
    dataCategories: ['tipo de solicitação', 'razão', 'resposta formal do controlador'],
    dataSubjects: 'Pacientes (titulares)',
    recipients: 'DPO/admin para processamento interno',
    retentionPeriod: 'Indefinido — evidência de conformidade auditável',
    technicalMeasures: [
      'SLA de 15 dias corridos monitorado (Art. 18, §5º)',
      'RLS: patient só visualiza e cria as próprias solicitações',
      'Audit log de toda ação com patientToken (pseudonimização)',
      'Resposta formal obrigatória do controlador',
    ],
    resourceKey: 'data_requests',
    actionKey: null,
  },
]

// LGPD: Art. 37 — gera ROPA com dados estáticos enriquecidos por métricas dos audit_logs
export async function getRopaService(actorUserId: string, actorRole: string): Promise<RopaResponse> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    // RLS admin para acessar todos os audit_logs
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // Query agregada por resource nos audit_logs — sem exposição de dados individuais
    const statsResult = await tx.execute(sql`
      SELECT resource, action, COUNT(*)::int as operation_count, MAX(created_at) as last_operation_at
      FROM audit_logs
      GROUP BY resource, action
    `)

    // Mapeia estatísticas por resource e action
    const statsByResource: Record<string, { count: number; lastAt: string | null }> = {}
    const statsByAction: Record<string, { count: number; lastAt: string | null }> = {}

    for (const row of statsResult.rows as Array<{ resource: string; action: string; operation_count: number; last_operation_at: string | null }>) {
      if (!statsByResource[row.resource]) {
        statsByResource[row.resource] = { count: 0, lastAt: null }
      }
      statsByResource[row.resource].count += row.operation_count
      if (row.last_operation_at) {
        const existing = statsByResource[row.resource].lastAt
        if (!existing || row.last_operation_at > existing) {
          statsByResource[row.resource].lastAt = row.last_operation_at
        }
      }

      if (!statsByAction[row.action]) {
        statsByAction[row.action] = { count: 0, lastAt: null }
      }
      statsByAction[row.action].count += row.operation_count
    }

    // Período coberto
    const periodResult = await tx.execute(sql`
      SELECT MIN(created_at) as period_from, MAX(created_at) as period_to FROM audit_logs
    `)
    const period = periodResult.rows[0] as { period_from: string | null; period_to: string | null }

    await client.query('COMMIT')

    // Enriquece cada atividade com métricas reais
    const activities = ROPA_STATIC_ACTIVITIES.map((activity) => {
      let operationCount = 0
      let lastOperationAt: string | null = null

      if (activity.resourceKey) {
        const stats = statsByResource[activity.resourceKey]
        if (stats) {
          operationCount = stats.count
          lastOperationAt = stats.lastAt
        }
      } else if (activity.actionKey) {
        const stats = statsByAction[activity.actionKey]
        if (stats) {
          operationCount = stats.count
          lastOperationAt = stats.lastAt
        }
      }

      const { resourceKey: _r, actionKey: _a, ...staticFields } = activity
      return { ...staticFields, operationCount, lastOperationAt }
    })

    const totalOperationsAudited = activities.reduce((sum, a) => sum + a.operationCount, 0)

    return {
      documentTitle:
        'ROPA — MedAgenda: Registro de Operações de Tratamento de Dados Pessoais',
      generatedAt: new Date().toISOString(),
      version: '5.0.0',
      legalReference: 'LGPD Art. 37 + Resolução CD/ANPD nº 2/2022',
      controller: {
        name: 'MedAgenda Ltda.',
        contact: 'dpo@medagenda.dev',
      },
      activities,
      totalOperationsAudited,
      periodCovered: {
        from: period.period_from ?? new Date().toISOString(),
        to: period.period_to ?? new Date().toISOString(),
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 6º, X — relatório de conformidade com métricas agregadas (sem dados individuais)
// Princípio da necessidade: apenas COUNT/SUM/AVG — nenhum dado pessoal identificável
export async function getComplianceReportService(
  actorUserId: string,
  actorRole: string,
): Promise<ComplianceReport> {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    // Consentimentos por finalidade
    const consentStats = await tx.execute(sql`
      SELECT purpose, granted,
        COUNT(*)::int as total,
        COUNT(revoked_at)::int as revoked_count
      FROM consents GROUP BY purpose, granted
    `)

    // Data requests por status e tipo
    const drStats = await tx.execute(sql`
      SELECT status, type, COUNT(*)::int as count,
        AVG(EXTRACT(EPOCH FROM (resolved_at - requested_at))/86400) as avg_days
      FROM data_requests GROUP BY status, type
    `)

    // Incidentes por severidade
    const incidentStats = await tx.execute(sql`
      SELECT severity, status, COUNT(*)::int as count
      FROM incidents GROUP BY severity, status
    `)

    // Audit logs por action e resource
    const auditStats = await tx.execute(sql`
      SELECT action, resource, COUNT(*)::int as count FROM audit_logs GROUP BY action, resource
    `)

    // Pacientes por estado
    const patientStats = await tx.execute(sql`
      SELECT
        COUNT(*)::int as total,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND anonymized_at IS NULL)::int as active,
        COUNT(*) FILTER (WHERE anonymized_at IS NOT NULL)::int as anonymized,
        COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int as deleted
      FROM patients
    `)

    // Período dos audit_logs
    const periodResult = await tx.execute(sql`
      SELECT MIN(created_at) as period_from, MAX(created_at) as period_to FROM audit_logs
    `)

    await client.query('COMMIT')

    // Processa consentimentos
    const byPurpose: Record<string, { granted: number; revoked: number }> = {}
    let totalConsents = 0, totalGranted = 0, totalRevoked = 0
    for (const row of consentStats.rows as Array<{ purpose: string; granted: boolean; total: number; revoked_count: number }>) {
      if (!byPurpose[row.purpose]) byPurpose[row.purpose] = { granted: 0, revoked: 0 }
      totalConsents += row.total
      if (row.granted) {
        totalGranted += row.total
        byPurpose[row.purpose].granted += row.total
      }
      totalRevoked += row.revoked_count
      byPurpose[row.purpose].revoked += row.revoked_count
    }

    // Processa data requests
    const drByStatus: Record<string, number> = {}
    const drByType: Record<string, number> = {}
    let totalDr = 0, drAvgDays: number | null = null, overdueCount = 0
    const avgValues: number[] = []
    for (const row of drStats.rows as Array<{ status: string; type: string; count: number; avg_days: number | null }>) {
      totalDr += row.count
      drByStatus[row.status] = (drByStatus[row.status] ?? 0) + row.count
      drByType[row.type] = (drByType[row.type] ?? 0) + row.count
      if (row.avg_days !== null) avgValues.push(Number(row.avg_days))
      if (row.status === 'pending' || row.status === 'in_progress') {
        // overdueCount calculado por SLA — não disponível diretamente na query sem deadlineAt
        // Para simplicidade: contar pending/in_progress como potencialmente overdue
        overdueCount += row.count
      }
    }
    if (avgValues.length > 0) {
      drAvgDays = Math.round((avgValues.reduce((a, b) => a + b, 0) / avgValues.length) * 10) / 10
    }

    // Processa incidentes
    const incBySeverity: Record<string, number> = {}
    let totalIncidents = 0, urgentOrOverdue = 0
    for (const row of incidentStats.rows as Array<{ severity: string; status: string; count: number }>) {
      totalIncidents += row.count
      incBySeverity[row.severity] = (incBySeverity[row.severity] ?? 0) + row.count
      if (row.status === 'open') urgentOrOverdue += row.count
    }

    // Processa audit logs
    const auditByAction: Record<string, number> = {}
    const auditByResource: Record<string, number> = {}
    let totalAuditLogs = 0
    for (const row of auditStats.rows as Array<{ action: string; resource: string; count: number }>) {
      totalAuditLogs += row.count
      auditByAction[row.action] = (auditByAction[row.action] ?? 0) + row.count
      auditByResource[row.resource] = (auditByResource[row.resource] ?? 0) + row.count
    }

    const patients = patientStats.rows[0] as { total: number; active: number; anonymized: number; deleted: number }
    const period = periodResult.rows[0] as { period_from: string | null; period_to: string | null }

    return {
      generatedAt: new Date().toISOString(),
      period: {
        from: period.period_from ?? new Date().toISOString(),
        to: period.period_to ?? new Date().toISOString(),
      },
      consents: {
        total: totalConsents,
        granted: totalGranted,
        revoked: totalRevoked,
        byPurpose,
      },
      dataRequests: {
        total: totalDr,
        byStatus: drByStatus,
        byType: drByType,
        avgResolutionDays: drAvgDays,
        overdueCount,
      },
      incidents: {
        total: totalIncidents,
        bySeverity: incBySeverity,
        urgentOrOverdue,
      },
      auditLogs: {
        total: totalAuditLogs,
        byAction: auditByAction,
        byResource: auditByResource,
      },
      patients: {
        total: patients.total,
        active: patients.active,
        anonymized: patients.anonymized,
        deleted: patients.deleted,
      },
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// LGPD: Art. 6º, X — listagem paginada de audit logs para o DPO
// patientToken visível (pseudonimização), patientId nunca exposto
export async function listAuditLogsService(
  actorUserId: string,
  actorRole: string,
  page: number,
  pageSize: number,
) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')
    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [actorUserId])
    await client.query(`SELECT set_config('app.current_role', $1, true)`, [actorRole])

    const tx = drizzle(client, { schema })

    const offset = (page - 1) * pageSize
    const rows = await tx.query.auditLogs.findMany({
      orderBy: [desc(auditLogs.createdAt)],
      limit: pageSize,
      offset,
    })

    // Total para paginação
    const countResult = await tx.execute(sql`SELECT COUNT(*)::int as total FROM audit_logs`)
    const total = (countResult.rows[0] as { total: number }).total

    await client.query('COMMIT')

    return {
      logs: rows.map((log) => ({
        id: log.id,
        userId: log.userId,
        patientToken: log.patientToken,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        legalBasis: log.legalBasis,
        ipAddress: log.ipAddress,
        metadata: log.metadata,
        createdAt: String(log.createdAt),
      })),
      total,
      page,
      pageSize,
    }
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
