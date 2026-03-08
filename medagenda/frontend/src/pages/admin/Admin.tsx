import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'
import { dataRequestTypeLabels } from '@medagenda/shared'
import { useEffect, useState } from 'react'

// ── Tipos ──────────────────────────────────────────────────────────────────

interface DataRequest {
  id: string
  patientId: string
  type: string
  status: 'pending' | 'in_progress' | 'completed' | 'denied' | 'expired'
  reason: string | null
  response: string | null
  deadlineAt: string
  requestedAt: string
  resolvedAt: string | null
  slaStatus: 'ok' | 'warning' | 'critical'
  slaRemainingDays: number
}

interface DataRequestList {
  dataRequests: DataRequest[]
  total: number
  pendingCount: number
  overdueCount: number
}

interface Incident {
  id: string
  title: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'notified' | 'resolved'
  detectedAt: string
  notifiedAnpdAt: string | null
  anpdAlertStatus: 'compliant' | 'pending' | 'urgent' | 'overdue'
  anpdDeadlineRemainingHours: number
}

interface IncidentList {
  incidents: Incident[]
  total: number
  urgentCount: number
}

interface AuditLog {
  id: string
  userId: string | null
  patientToken: string | null
  action: string
  resource: string
  resourceId: string | null
  legalBasis: string | null
  ipAddress: string | null
  createdAt: string
}

interface AuditLogList {
  logs: AuditLog[]
  total: number
  page: number
  pageSize: number
}

interface RopaActivity {
  activityName: string
  purpose: string
  legalBasis: string
  dataCategories: string[]
  dataSubjects: string
  retentionPeriod: string
  operationCount: number
  lastOperationAt: string | null
}

interface RopaDocument {
  documentTitle: string
  generatedAt: string
  version: string
  legalReference: string
  activities: RopaActivity[]
  totalOperationsAudited: number
  periodCovered: { from: string; to: string }
}

interface ComplianceReport {
  generatedAt: string
  consents: {
    total: number
    granted: number
    revoked: number
    byPurpose: Record<string, { granted: number; revoked: number }>
  }
  dataRequests: {
    total: number
    byStatus: Record<string, number>
    byType: Record<string, number>
    avgResolutionDays: number | null
    overdueCount: number
  }
  incidents: {
    total: number
    bySeverity: Record<string, number>
    urgentOrOverdue: number
  }
  auditLogs: {
    total: number
    byAction: Record<string, number>
    byResource: Record<string, number>
  }
  patients: {
    total: number
    active: number
    anonymized: number
    deleted: number
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const drStatusLabels: Record<DataRequest['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em análise',
  completed: 'Concluída',
  denied: 'Negada',
  expired: 'Expirada',
}

const slaVariants: Record<'ok' | 'warning' | 'critical', 'secondary' | 'default' | 'destructive'> = {
  ok: 'secondary',
  warning: 'default',
  critical: 'destructive',
}

const anpdVariants: Record<Incident['anpdAlertStatus'], 'secondary' | 'outline' | 'default' | 'destructive'> = {
  compliant: 'secondary',
  pending: 'outline',
  urgent: 'default',
  overdue: 'destructive',
}

const anpdLabels: Record<Incident['anpdAlertStatus'], string> = {
  compliant: 'Notificado',
  pending: 'Pendente',
  urgent: 'Urgente',
  overdue: 'Vencido',
}

const severityVariants: Record<Incident['severity'], 'secondary' | 'outline' | 'default' | 'destructive'> = {
  low: 'outline',
  medium: 'secondary',
  high: 'default',
  critical: 'destructive',
}

type Tab = 'solicitacoes' | 'incidentes' | 'audit-logs' | 'ropa' | 'conformidade'

// LGPD: Art. 6º, X — dashboard do DPO para monitoramento de conformidade
export function Admin() {
  const [activeTab, setActiveTab] = useState<Tab>('solicitacoes')

  // ── Data requests ──
  const [drData, setDrData] = useState<DataRequestList | null>(null)
  const [loadingDr, setLoadingDr] = useState(false)
  const [resolveForm, setResolveForm] = useState<{
    id: string
    action: 'complete' | 'deny'
    response: string
  } | null>(null)

  // ── Incidents ──
  const [incidentsData, setIncidentsData] = useState<IncidentList | null>(null)
  const [loadingIncidents, setLoadingIncidents] = useState(false)

  // ── Audit logs ──
  const [auditData, setAuditData] = useState<AuditLogList | null>(null)
  const [auditPage, setAuditPage] = useState(1)
  const [loadingAudit, setLoadingAudit] = useState(false)

  // ── ROPA ──
  const [ropa, setRopa] = useState<RopaDocument | null>(null)
  const [loadingRopa, setLoadingRopa] = useState(false)

  // ── Compliance ──
  const [report, setReport] = useState<ComplianceReport | null>(null)
  const [loadingReport, setLoadingReport] = useState(false)

  // Carrega dados ao trocar de aba
  useEffect(() => {
    if (activeTab === 'solicitacoes' && !drData) {
      setLoadingDr(true)
      api.get<DataRequestList>('/data-requests')
        .then((r) => setDrData(r.data))
        .finally(() => setLoadingDr(false))
    }
    if (activeTab === 'incidentes' && !incidentsData) {
      setLoadingIncidents(true)
      api.get<IncidentList>('/incidents')
        .then((r) => setIncidentsData(r.data))
        .finally(() => setLoadingIncidents(false))
    }
    if (activeTab === 'audit-logs' && !auditData) {
      loadAuditLogs(1)
    }
    if (activeTab === 'ropa' && !ropa) {
      setLoadingRopa(true)
      api.get<RopaDocument>('/compliance/ropa')
        .then((r) => setRopa(r.data))
        .finally(() => setLoadingRopa(false))
    }
    if (activeTab === 'conformidade' && !report) {
      setLoadingReport(true)
      api.get<ComplianceReport>('/compliance/report')
        .then((r) => setReport(r.data))
        .finally(() => setLoadingReport(false))
    }
  }, [activeTab])

  function loadAuditLogs(page: number) {
    setLoadingAudit(true)
    setAuditPage(page)
    api.get<AuditLogList>(`/compliance/audit-logs?page=${page}&pageSize=20`)
      .then((r) => setAuditData(r.data))
      .finally(() => setLoadingAudit(false))
  }

  async function onResolveDataRequest() {
    if (!resolveForm) return
    const url = `/data-requests/${resolveForm.id}/${resolveForm.action === 'complete' ? 'complete' : 'deny'}`
    await api.patch(url, { response: resolveForm.response })
    setResolveForm(null)
    // Recarregar
    setDrData(null)
    setLoadingDr(true)
    api.get<DataRequestList>('/data-requests')
      .then((r) => setDrData(r.data))
      .finally(() => setLoadingDr(false))
  }

  async function onNotifyAnpd(incidentId: string) {
    await api.patch(`/incidents/${incidentId}/notify-anpd`)
    setIncidentsData(null)
    setLoadingIncidents(true)
    api.get<IncidentList>('/incidents')
      .then((r) => setIncidentsData(r.data))
      .finally(() => setLoadingIncidents(false))
  }

  async function onDownloadReport() {
    const res = await api.get('/compliance/report?download=true', { responseType: 'blob' })
    const url = URL.createObjectURL(res.data as Blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio-conformidade-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onDownloadRopa() {
    if (!ropa) return
    const blob = new Blob([JSON.stringify(ropa, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `ropa-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'solicitacoes', label: 'Solicitações' },
    { key: 'incidentes', label: 'Incidentes' },
    { key: 'audit-logs', label: 'Audit Logs' },
    { key: 'ropa', label: 'ROPA' },
    { key: 'conformidade', label: 'Conformidade' },
  ]

  return (
    // LGPD: Art. 6º, X — dashboard de conformidade restrito ao DPO/admin
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Dashboard DPO</h1>
        <p className="text-sm text-muted-foreground">
          Painel de conformidade LGPD — acesso restrito ao administrador
        </p>
      </div>

      {/* Abas de navegação */}
      <div className="mb-6 flex gap-1 border-b">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Aba 1: Fila de Solicitações ── */}
      {activeTab === 'solicitacoes' && (
        <div className="space-y-4">
          {/* LGPD: Art. 18, §5º — SLA de 15 dias monitorado pelo DPO */}
          {drData && (
            <div className="flex gap-4">
              <Card className="flex-1">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold">{drData.pendingCount}</p>
                  <p className="text-sm text-muted-foreground">Em aberto</p>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold text-destructive">{drData.overdueCount}</p>
                  <p className="text-sm text-muted-foreground">SLA crítico</p>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold">{drData.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </div>
          )}

          {loadingDr && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {drData && drData.dataRequests.map((dr) => (
            <Card key={dr.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">
                      {dataRequestTypeLabels[dr.type as keyof typeof dataRequestTypeLabels] ?? dr.type}
                    </p>
                    {/* LGPD: Art. 6º, III — necessidade — apenas ID truncado do paciente */}
                    <p className="text-xs text-muted-foreground font-mono">
                      Paciente: {dr.patientId.slice(0, 8)}…
                    </p>
                    {dr.reason && (
                      <p className="text-xs text-muted-foreground">Motivo: {dr.reason}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Prazo: {new Date(dr.deadlineAt).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={statusVariants[dr.status]}>{drStatusLabels[dr.status]}</Badge>
                    {(dr.status === 'pending' || dr.status === 'in_progress') && (
                      <Badge variant={slaVariants[dr.slaStatus]}>
                        {dr.slaRemainingDays.toFixed(1)} dias
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Ações para solicitações abertas */}
                {(dr.status === 'pending' || dr.status === 'in_progress') && (
                  <div className="mt-3">
                    {resolveForm?.id === dr.id ? (
                      <div className="space-y-2">
                        <Textarea
                          rows={2}
                          placeholder="Resposta formal ao titular (obrigatório)..."
                          value={resolveForm.response}
                          onChange={(e) =>
                            setResolveForm({ ...resolveForm, response: e.target.value })
                          }
                        />
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={onResolveDataRequest}
                            disabled={!resolveForm.response.trim()}
                          >
                            {resolveForm.action === 'complete' ? 'Concluir' : 'Negar'}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setResolveForm(null)}>
                            Cancelar
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResolveForm({ id: dr.id, action: 'complete', response: '' })
                          }
                        >
                          Concluir
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            setResolveForm({ id: dr.id, action: 'deny', response: '' })
                          }
                        >
                          Negar
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {dr.response && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Resposta: {dr.response}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Aba 2: Incidentes ── */}
      {activeTab === 'incidentes' && (
        <div className="space-y-4">
          {/* LGPD: Art. 48 + Resolução CD/ANPD nº 15/2024 — prazo de 72h */}
          {incidentsData && (
            <div className="flex gap-4">
              <Card className="flex-1">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold text-destructive">{incidentsData.urgentCount}</p>
                  <p className="text-sm text-muted-foreground">Urgente/Vencido</p>
                </CardContent>
              </Card>
              <Card className="flex-1">
                <CardContent className="pt-4 text-center">
                  <p className="text-3xl font-bold">{incidentsData.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </CardContent>
              </Card>
            </div>
          )}

          {loadingIncidents && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {incidentsData && incidentsData.incidents.map((incident) => (
            <Card key={incident.id}>
              <CardContent className="pt-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{incident.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Detectado: {new Date(incident.detectedAt).toLocaleString('pt-BR')}
                    </p>
                    {incident.notifiedAnpdAt && (
                      <p className="text-xs text-muted-foreground">
                        ANPD notificada: {new Date(incident.notifiedAnpdAt).toLocaleString('pt-BR')}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Horas restantes: {incident.anpdDeadlineRemainingHours.toFixed(1)}h
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={severityVariants[incident.severity]}>{incident.severity}</Badge>
                    <Badge variant={anpdVariants[incident.anpdAlertStatus]}>
                      {anpdLabels[incident.anpdAlertStatus]}
                    </Badge>
                  </div>
                </div>
                {incident.status === 'open' && (
                  <div className="mt-3">
                    <Button size="sm" variant="outline" onClick={() => onNotifyAnpd(incident.id)}>
                      Notificar ANPD
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* ── Aba 3: Audit Logs ── */}
      {activeTab === 'audit-logs' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {/* LGPD: Art. 6º, X — patientToken visível, patientId nunca exposto */}
              Logs com patientToken (pseudonimizado) — sem exposição de patientId
            </p>
            {auditData && (
              <p className="text-sm text-muted-foreground">
                Página {auditData.page} — {auditData.total} registros
              </p>
            )}
          </div>

          {loadingAudit && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {auditData && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4">Ação</th>
                    <th className="pb-2 pr-4">Recurso</th>
                    <th className="pb-2 pr-4">Token Paciente</th>
                    <th className="pb-2 pr-4">Base Legal</th>
                    <th className="pb-2 pr-4">IP</th>
                    <th className="pb-2">Data/Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {auditData.logs.map((log) => (
                    <tr key={log.id} className="border-b hover:bg-muted/50">
                      <td className="py-2 pr-4">
                        <Badge variant="outline">{log.action}</Badge>
                      </td>
                      <td className="py-2 pr-4 font-mono">{log.resource}</td>
                      <td className="py-2 pr-4 font-mono">
                        {log.patientToken ? `${log.patientToken.slice(0, 8)}…` : '—'}
                      </td>
                      <td className="py-2 pr-4">{log.legalBasis ?? '—'}</td>
                      <td className="py-2 pr-4">{log.ipAddress ?? '—'}</td>
                      <td className="py-2">
                        {new Date(log.createdAt).toLocaleString('pt-BR', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {auditData && (
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={auditData.page <= 1}
                onClick={() => loadAuditLogs(auditData.page - 1)}
              >
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={auditData.page * auditData.pageSize >= auditData.total}
                onClick={() => loadAuditLogs(auditData.page + 1)}
              >
                Próximo
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── Aba 4: ROPA ── */}
      {activeTab === 'ropa' && (
        <div className="space-y-4">
          {loadingRopa && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {ropa && (
            <>
              <div className="flex items-start justify-between">
                <div>
                  {/* LGPD: Art. 37 + Resolução CD/ANPD nº 2/2022 — ROPA obrigatório */}
                  <h2 className="font-semibold">{ropa.documentTitle}</h2>
                  <p className="text-xs text-muted-foreground">
                    Versão {ropa.version} — {new Date(ropa.generatedAt).toLocaleString('pt-BR')}
                  </p>
                  <p className="text-xs text-muted-foreground">{ropa.legalReference}</p>
                </div>
                <Button variant="outline" onClick={onDownloadRopa}>
                  Exportar JSON
                </Button>
              </div>

              <div className="flex gap-4 text-sm">
                <div className="rounded border px-3 py-2">
                  <span className="text-muted-foreground">Total de operações auditadas: </span>
                  <strong>{ropa.totalOperationsAudited}</strong>
                </div>
                <div className="rounded border px-3 py-2">
                  <span className="text-muted-foreground">Período: </span>
                  <strong>
                    {new Date(ropa.periodCovered.from).toLocaleDateString('pt-BR')} —{' '}
                    {new Date(ropa.periodCovered.to).toLocaleDateString('pt-BR')}
                  </strong>
                </div>
              </div>

              <Separator />

              <div className="space-y-3">
                {ropa.activities.map((activity) => (
                  <Card key={activity.activityName}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-sm">{activity.activityName}</CardTitle>
                        <Badge variant="outline">{activity.operationCount} ops</Badge>
                      </div>
                      <CardDescription className="text-xs">{activity.purpose}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-xs space-y-1">
                      <p><span className="text-muted-foreground">Base legal:</span> {activity.legalBasis}</p>
                      <p><span className="text-muted-foreground">Sujeitos:</span> {activity.dataSubjects}</p>
                      <p><span className="text-muted-foreground">Retenção:</span> {activity.retentionPeriod}</p>
                      <p>
                        <span className="text-muted-foreground">Categorias: </span>
                        {activity.dataCategories.join(', ')}
                      </p>
                      {activity.lastOperationAt && (
                        <p>
                          <span className="text-muted-foreground">Última operação: </span>
                          {new Date(activity.lastOperationAt).toLocaleString('pt-BR')}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Aba 5: Relatório de Conformidade ── */}
      {activeTab === 'conformidade' && (
        <div className="space-y-4">
          {loadingReport && <p className="text-sm text-muted-foreground">Carregando...</p>}

          {report && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  {/* LGPD: Art. 6º, X — responsabilização — evidência auditável */}
                  <h2 className="font-semibold">Relatório de Conformidade</h2>
                  <p className="text-xs text-muted-foreground">
                    Gerado em {new Date(report.generatedAt).toLocaleString('pt-BR')} — LGPD Art. 6º, X
                  </p>
                </div>
                <Button variant="outline" onClick={onDownloadReport}>
                  Exportar JSON
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{report.patients.total}</p>
                    <p className="text-xs text-muted-foreground">Pacientes total</p>
                    <p className="text-xs text-muted-foreground">{report.patients.active} ativos</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{report.consents.total}</p>
                    <p className="text-xs text-muted-foreground">Consentimentos</p>
                    <p className="text-xs text-muted-foreground">{report.consents.revoked} revogados</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{report.dataRequests.total}</p>
                    <p className="text-xs text-muted-foreground">Solicitações Art. 18</p>
                    {report.dataRequests.avgResolutionDays !== null && (
                      <p className="text-xs text-muted-foreground">
                        Média: {report.dataRequests.avgResolutionDays.toFixed(1)} dias
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-4 text-center">
                    <p className="text-2xl font-bold">{report.incidents.total}</p>
                    <p className="text-xs text-muted-foreground">Incidentes</p>
                    <p className="text-xs text-muted-foreground text-destructive">
                      {report.incidents.urgentOrOverdue} urgentes
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Consentimentos por finalidade</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {Object.entries(report.consents.byPurpose).map(([purpose, stats]) => (
                      <div key={purpose} className="flex justify-between">
                        <span className="text-muted-foreground">{purpose}</span>
                        <span>{stats.granted} concedidos, {stats.revoked} revogados</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Solicitações por status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {Object.entries(report.dataRequests.byStatus).map(([status, count]) => (
                      <div key={status} className="flex justify-between">
                        <span className="text-muted-foreground">{status}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Audit logs por ação</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {Object.entries(report.auditLogs.byAction).map(([action, count]) => (
                      <div key={action} className="flex justify-between">
                        <span className="text-muted-foreground">{action}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Incidentes por severidade</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 text-xs">
                    {Object.entries(report.incidents.bySeverity).map(([severity, count]) => (
                      <div key={severity} className="flex justify-between">
                        <span className="text-muted-foreground">{severity}</span>
                        <span>{count}</span>
                      </div>
                    ))}
                    {report.patients.anonymized > 0 && (
                      <div className="flex justify-between border-t pt-1">
                        <span className="text-muted-foreground">Pacientes anonimizados</span>
                        <span>{report.patients.anonymized}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// Helper necessário para badge de solicitações
const statusVariants: Record<DataRequest['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'default',
  in_progress: 'outline',
  completed: 'secondary',
  denied: 'destructive',
  expired: 'outline',
}
