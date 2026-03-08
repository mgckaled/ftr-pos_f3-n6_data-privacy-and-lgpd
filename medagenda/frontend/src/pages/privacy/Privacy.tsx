import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'
import {
  dataRequestTypeLabels,
  dataRequestTypes,
  createDataRequestBodySchema,
  type DataRequestType,
  type CreateDataRequestBody,
} from '@medagenda/shared'

// LGPD: Art. 18, III — campos corrigíveis pelo titular (nunca CPF, base legal, timestamps)
const updateMeSchema = z.object({
  name: z.string().min(2).optional(),
  email: z.string().email().optional().or(z.literal('')),
  phone: z.string().optional(),
})
type UpdateMeForm = z.infer<typeof updateMeSchema>

interface PatientData {
  id: string
  name: string
  email: string | null
  phone: string | null
  birthDate: string | null
  legalBasis: string
  retentionExpiresAt: string | null
  createdAt: string
}

interface ConsentData {
  id: string
  purpose: string
  granted: boolean
  grantedAt: string
  revokedAt: string | null
  policyVersion: string
}

interface DataRequest {
  id: string
  type: DataRequestType
  status: 'pending' | 'in_progress' | 'completed' | 'denied' | 'expired'
  reason: string | null
  response: string | null
  deadlineAt: string
  requestedAt: string
  resolvedAt: string | null
  slaStatus: 'ok' | 'warning' | 'critical'
  slaRemainingDays: number
}

// LGPD: Art. 18 — rótulos de finalidade de consentimento em linguagem simples
const purposeLabels: Record<string, string> = {
  medical_treatment: 'Tratamento médico e gestão de consultas',
  data_sharing_partners: 'Compartilhamento com parceiros de saúde',
  research: 'Pesquisa científica com dados anonimizados',
  insurance: 'Processamento por operadoras de seguro',
  marketing: 'Comunicações, novidades e promoções',
}

const statusLabels: Record<DataRequest['status'], string> = {
  pending: 'Pendente',
  in_progress: 'Em análise',
  completed: 'Concluída',
  denied: 'Negada',
  expired: 'Expirada',
}

const statusVariants: Record<DataRequest['status'], 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'default',
  in_progress: 'outline',
  completed: 'secondary',
  denied: 'destructive',
  expired: 'outline',
}

const slaVariants: Record<DataRequest['slaStatus'], 'default' | 'secondary' | 'destructive'> = {
  ok: 'secondary',
  warning: 'default',
  critical: 'destructive',
}

type Section = 'meus-dados' | 'consentimentos' | 'exportar' | 'solicitacoes' | 'nova-solicitacao'

// LGPD: Art. 18 — painel do titular com todos os direitos da lei
export function Privacy() {
  const { user } = useAuth()
  const [activeSection, setActiveSection] = useState<Section>('meus-dados')

  // Dados do titular — carregados no mount e atualizados após operações
  const [patientData, setPatientData] = useState<PatientData | null>(null)
  const [consents, setConsents] = useState<ConsentData[]>([])
  const [loadingMe, setLoadingMe] = useState(true)
  const [errorMe, setErrorMe] = useState<string | null>(null)

  // Solicitações do titular
  const [dataRequests, setDataRequests] = useState<DataRequest[]>([])
  const [loadingRequests, setLoadingRequests] = useState(false)

  // Formulário de edição de dados
  const [isEditing, setIsEditing] = useState(false)
  const editForm = useForm<UpdateMeForm>({ resolver: zodResolver(updateMeSchema) })

  // Formulário de nova solicitação — schema importado de @medagenda/shared
  const requestForm = useForm<CreateDataRequestBody>({
    resolver: zodResolver(createDataRequestBodySchema),
  })

  function fetchMe() {
    setLoadingMe(true)
    api
      .get<{ patient: PatientData; consents: ConsentData[] }>('/privacy/me')
      .then((res) => {
        setPatientData(res.data.patient)
        setConsents(res.data.consents)
        setErrorMe(null)
      })
      .catch(() => setErrorMe('Erro ao carregar seus dados.'))
      .finally(() => setLoadingMe(false))
  }

  function fetchRequests() {
    setLoadingRequests(true)
    api
      .get<{ dataRequests: DataRequest[] }>('/data-requests')
      .then((res) => setDataRequests(res.data.dataRequests))
      .catch(() => {})
      .finally(() => setLoadingRequests(false))
  }

  useEffect(() => {
    fetchMe()
  }, [])

  // Carregar solicitações ao entrar nas seções correspondentes
  useEffect(() => {
    if (activeSection === 'solicitacoes' || activeSection === 'nova-solicitacao') {
      fetchRequests()
    }
  }, [activeSection])

  async function onUpdateMe(data: UpdateMeForm) {
    const payload: UpdateMeForm = {}
    if (data.name) payload.name = data.name
    if (data.email !== undefined) payload.email = data.email
    if (data.phone !== undefined) payload.phone = data.phone

    await api.patch('/privacy/me', payload)
    setIsEditing(false)
    fetchMe()
  }

  async function onRevokeConsent(purpose: string) {
    if (!confirm(`Deseja revogar o consentimento para "${purposeLabels[purpose]}"?`)) return
    await api.post(`/privacy/consents/${purpose}/revoke`)
    fetchMe()
  }

  async function onExport(format: 'json' | 'csv') {
    const res = await api.get(`/privacy/export?format=${format}`, {
      responseType: format === 'csv' ? 'blob' : 'json',
    })
    const blob =
      format === 'csv'
        ? (res.data as Blob)
        : new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `meus-dados.${format}`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function onCreateRequest(data: CreateDataRequestBody) {
    await api.post('/data-requests', data)
    requestForm.reset()
    setActiveSection('solicitacoes')
  }

  const navItems: { key: Section; label: string }[] = [
    { key: 'meus-dados', label: 'Meus Dados' },
    { key: 'consentimentos', label: 'Consentimentos' },
    { key: 'exportar', label: 'Exportar Dados' },
    { key: 'solicitacoes', label: 'Minhas Solicitações' },
    { key: 'nova-solicitacao', label: 'Nova Solicitação' },
  ]

  if (loadingMe) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (errorMe) {
    return (
      <div className="flex min-h-screen items-center justify-center text-destructive">
        {errorMe}
      </div>
    )
  }

  return (
    // LGPD: Art. 18 — painel do titular com todos os direitos garantidos pela lei
    <div className="mx-auto flex max-w-5xl gap-6 p-6">
      {/* Navegação lateral */}
      <nav className="w-52 shrink-0">
        <div className="mb-4">
          <h2 className="font-semibold">Painel do Titular</h2>
          <p className="text-xs text-muted-foreground">{user?.name}</p>
        </div>
        <div className="space-y-1">
          {navItems.map((item) => (
            <button
              key={item.key}
              onClick={() => setActiveSection(item.key)}
              className={`w-full rounded px-3 py-2 text-left text-sm transition-colors ${
                activeSection === item.key
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <Separator className="my-4" />
        <p className="text-xs text-muted-foreground">
          LGPD Art. 18 — seus direitos como titular dos dados
        </p>
      </nav>

      {/* Conteúdo principal */}
      <div className="flex-1">
        {/* ── Seção 1: Meus Dados ── */}
        {activeSection === 'meus-dados' && patientData && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Meus Dados Pessoais</CardTitle>
                    {/* LGPD: Art. 18, I — direito de acesso e confirmação de tratamento */}
                    <CardDescription>Art. 18, I e III LGPD — visualizar e corrigir</CardDescription>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        editForm.setValue('name', patientData.name)
                        editForm.setValue('email', patientData.email ?? '')
                        editForm.setValue('phone', patientData.phone ?? '')
                        setIsEditing(true)
                      }}
                    >
                      Editar
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditing ? (
                  <form onSubmit={editForm.handleSubmit(onUpdateMe)} className="space-y-4">
                    <div className="space-y-1">
                      <Label htmlFor="name">Nome completo</Label>
                      <Input id="name" {...editForm.register('name')} />
                      {editForm.formState.errors.name && (
                        <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="email">E-mail</Label>
                      <Input id="email" type="email" {...editForm.register('email')} />
                      {editForm.formState.errors.email && (
                        <p className="text-xs text-destructive">{editForm.formState.errors.email.message}</p>
                      )}
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor="phone">Telefone</Label>
                      <Input id="phone" {...editForm.register('phone')} />
                    </div>
                    <div className="flex gap-2">
                      <Button type="submit" disabled={editForm.formState.isSubmitting}>
                        Salvar
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setIsEditing(false)}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                ) : (
                  <dl className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Nome</dt>
                      <dd className="font-medium">{patientData.name}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">E-mail</dt>
                      <dd>{patientData.email ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Telefone</dt>
                      <dd>{patientData.phone ?? '—'}</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Data de nascimento</dt>
                      <dd>{patientData.birthDate ?? '—'}</dd>
                    </div>
                    <Separator />
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Base legal</dt>
                      <dd>
                        {/* LGPD: Art. 7º — base legal que justifica o tratamento */}
                        <Badge variant="outline">{patientData.legalBasis}</Badge>
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Retenção até</dt>
                      <dd>
                        {patientData.retentionExpiresAt
                          ? new Date(patientData.retentionExpiresAt).toLocaleDateString('pt-BR')
                          : '—'}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-muted-foreground">Cadastrado em</dt>
                      <dd>{new Date(patientData.createdAt).toLocaleDateString('pt-BR')}</dd>
                    </div>
                    {/* LGPD: Art. 6º, III — necessidade — CPF não exibido ao titular via painel */}
                    <p className="text-xs text-muted-foreground">
                      CPF não exibido — armazenado de forma criptografada (Art. 6º, VII)
                    </p>
                  </dl>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Seção 2: Consentimentos ── */}
        {activeSection === 'consentimentos' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Meus Consentimentos</CardTitle>
                {/* LGPD: Art. 18, IX — direito de revogação de consentimento a qualquer momento */}
                <CardDescription>Art. 8º e Art. 18, IX LGPD — visualizar e revogar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {consents.length === 0 && (
                  <p className="text-sm text-muted-foreground">Nenhum consentimento registrado.</p>
                )}
                {consents.map((consent) => (
                  <div
                    key={consent.id}
                    className="flex items-start justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-sm">
                        {purposeLabels[consent.purpose] ?? consent.purpose}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Versão da política: {consent.policyVersion}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Concedido em: {new Date(consent.grantedAt).toLocaleDateString('pt-BR')}
                      </p>
                      {consent.revokedAt && (
                        <p className="text-xs text-destructive">
                          Revogado em: {new Date(consent.revokedAt).toLocaleDateString('pt-BR')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      {/* LGPD: Art. 8º — status do consentimento por finalidade */}
                      <Badge variant={consent.revokedAt ? 'destructive' : 'secondary'}>
                        {consent.revokedAt ? 'Revogado' : consent.granted ? 'Concedido' : 'Negado'}
                      </Badge>
                      {!consent.revokedAt && consent.granted && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onRevokeConsent(consent.purpose)}
                        >
                          Revogar
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Seção 3: Exportar Dados ── */}
        {activeSection === 'exportar' && (
          <Card>
            <CardHeader>
              <CardTitle>Exportar Meus Dados</CardTitle>
              {/* LGPD: Art. 18, V — portabilidade dos dados pessoais */}
              <CardDescription>Art. 18, V LGPD — portabilidade em formato interoperável</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exporte todos os seus dados pessoais, consentimentos e solicitações registradas.
              </p>
              <div className="flex gap-3">
                <Button onClick={() => onExport('json')}>Exportar JSON</Button>
                <Button variant="outline" onClick={() => onExport('csv')}>
                  Exportar CSV
                </Button>
              </div>
              {/* LGPD: Art. 11 — dados sensíveis de saúde exigem tratamento diferenciado */}
              <p className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
                <strong>Nota:</strong> Prontuários médicos (dados sensíveis de saúde) não são incluídos nesta
                exportação. Dados de saúde estão sujeitos ao Art. 11 da LGPD e requerem solicitação
                específica ao controlador.
              </p>
            </CardContent>
          </Card>
        )}

        {/* ── Seção 4: Minhas Solicitações ── */}
        {activeSection === 'solicitacoes' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-semibold">Minhas Solicitações</h2>
                <p className="text-sm text-muted-foreground">Art. 18 LGPD — histórico de exercício de direitos</p>
              </div>
              <Button onClick={() => setActiveSection('nova-solicitacao')}>Nova solicitação</Button>
            </div>
            {loadingRequests ? (
              <p className="text-sm text-muted-foreground">Carregando...</p>
            ) : dataRequests.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">
                  Nenhuma solicitação registrada.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {dataRequests.map((dr) => (
                  <Card key={dr.id}>
                    <CardContent className="flex items-start justify-between pt-4">
                      <div className="space-y-1">
                        <p className="font-medium text-sm">
                          {dataRequestTypeLabels[dr.type]}
                        </p>
                        {dr.reason && (
                          <p className="text-xs text-muted-foreground">Motivo: {dr.reason}</p>
                        )}
                        {dr.response && (
                          <p className="text-xs text-muted-foreground">Resposta: {dr.response}</p>
                        )}
                        <p className="text-xs text-muted-foreground">
                          Solicitado em: {new Date(dr.requestedAt).toLocaleDateString('pt-BR')}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Prazo: {new Date(dr.deadlineAt).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={statusVariants[dr.status]}>{statusLabels[dr.status]}</Badge>
                        {/* LGPD: Art. 18, §5º — SLA de 15 dias monitorado */}
                        {dr.status === 'pending' || dr.status === 'in_progress' ? (
                          <Badge variant={slaVariants[dr.slaStatus]}>
                            SLA: {dr.slaRemainingDays.toFixed(1)} dias
                          </Badge>
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Seção 5: Nova Solicitação ── */}
        {activeSection === 'nova-solicitacao' && (
          <Card>
            <CardHeader>
              <CardTitle>Nova Solicitação de Direito</CardTitle>
              {/* LGPD: Art. 18 — rol taxativo de direitos do titular */}
              <CardDescription>Art. 18 LGPD — prazo de resposta: 15 dias corridos</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={requestForm.handleSubmit(onCreateRequest)} className="space-y-4">
                <div className="space-y-1">
                  <Label htmlFor="type">Tipo de solicitação</Label>
                  <select
                    id="type"
                    className="w-full rounded-md border bg-background px-3 py-2 text-sm"
                    {...requestForm.register('type')}
                  >
                    <option value="">Selecione...</option>
                    {dataRequestTypes.map((t) => (
                      <option key={t} value={t}>
                        {dataRequestTypeLabels[t]}
                      </option>
                    ))}
                  </select>
                  {requestForm.formState.errors.type && (
                    <p className="text-xs text-destructive">Selecione um tipo de solicitação.</p>
                  )}
                </div>
                <div className="space-y-1">
                  <Label htmlFor="reason">Motivo (opcional)</Label>
                  <Textarea
                    id="reason"
                    rows={3}
                    placeholder="Descreva brevemente o motivo da solicitação..."
                    {...requestForm.register('reason')}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" disabled={requestForm.formState.isSubmitting}>
                    Enviar solicitação
                  </Button>
                  <Button type="button" variant="outline" onClick={() => setActiveSection('solicitacoes')}>
                    Cancelar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
