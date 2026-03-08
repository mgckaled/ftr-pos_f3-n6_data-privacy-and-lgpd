import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

interface AppointmentData {
  id: string
  patientId: string // LGPD: dado pessoal — Art. 5º, I
  doctorId: string // LGPD: dado pessoal — Art. 5º, I
  scheduledAt: string // LGPD: dado pessoal — Art. 5º, I
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null // LGPD: dado pessoal — Art. 5º, I
  retentionExpiresAt: string
  deletedAt: string | null
  createdAt: string
}

// LGPD: Art. 5º, II — dados sensíveis de saúde: não persistir em estado global
// Usado apenas em estado local deste componente; descartado ao desmontar
interface MedicalRecordData {
  id: string
  appointmentId: string
  patientId: string // LGPD: dado pessoal — Art. 5º, I
  doctorId: string // LGPD: dado pessoal — Art. 5º, I
  diagnosis: string | null // LGPD: dado sensível — Art. 5º, II
  prescription: string | null // LGPD: dado sensível — Art. 5º, II
  clinicalNotes: string | null // LGPD: dado sensível — Art. 5º, II
  icdCode: string | null // LGPD: dado sensível — Art. 5º, II
  sensitiveLegalBasis: string
  retentionExpiresAt: string
  createdAt: string
}

// Schema de criação de prontuário (LGPD: Art. 11 — dado sensível com base legal específica)
const medicalRecordSchema = z.object({
  appointmentId: z.string().uuid(),
  diagnosis: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  prescription: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  clinicalNotes: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  icdCode: z.string().optional(), // LGPD: dado sensível — Art. 5º, II
  sensitiveLegalBasis: z
    .enum(['health_care', 'vital_interest', 'research_anonymized', 'legal_obligation'])
    .default('health_care'),
})

type MedicalRecordForm = z.infer<typeof medicalRecordSchema>

const statusLabels = {
  scheduled: 'Agendado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
} as const

// LGPD: Art. 6º, X — cada acesso a este componente gera audit_log no backend
export function AppointmentDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()

  const [appointment, setAppointment] = useState<AppointmentData | null>(null)
  // LGPD: Art. 5º, II — dado sensível: armazenado apenas em estado local, descartado ao desmontar
  const [medicalRecord, setMedicalRecord] = useState<MedicalRecordData | null>(null)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancelLoading, setCancelLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<MedicalRecordForm>({
    resolver: zodResolver(medicalRecordSchema),
    defaultValues: { appointmentId: id, sensitiveLegalBasis: 'health_care' },
  })

  useEffect(() => {
    if (!id) return

    // LGPD: Art. 6º, X — acesso ao agendamento registrado via audit_log no backend
    api
      .get<AppointmentData>(`/appointments/${id}`)
      .then((res) => {
        setAppointment(res.data)
        // Médicos carregam o prontuário apenas se já existir
        if (user?.role === 'doctor' || user?.role === 'admin') {
          return api.get<MedicalRecordData>(`/medical-records/${id}`).then((r) =>
            // LGPD: Art. 5º, II — dado sensível: armazenado apenas em estado local
            setMedicalRecord(r.data),
          ).catch(() => {
            // Prontuário ainda não existe — não é erro
            setMedicalRecord(null)
          })
        }
      })
      .catch(() => setError('Agendamento não encontrado ou sem permissão de acesso.'))
      .finally(() => setLoading(false))

    // LGPD: Art. 5º, II — cleanup ao desmontar: dado sensível descartado da memória
    return () => {
      setMedicalRecord(null)
    }
  }, [id, user?.role])

  async function handleCancel() {
    if (!id) return
    setCancelLoading(true)
    try {
      await api.patch(`/appointments/${id}/cancel`)
      setAppointment((prev) => prev ? { ...prev, status: 'cancelled' } : prev)
    } catch {
      setError('Erro ao cancelar agendamento.')
    } finally {
      setCancelLoading(false)
    }
  }

  async function onSubmitRecord(data: MedicalRecordForm) {
    try {
      // LGPD: Art. 11 — criação de dado sensível: acesso restrito ao médico responsável
      const res = await api.post<{ id: string }>('/medical-records', data)
      // Recarrega o prontuário após criação
      const updated = await api.get<MedicalRecordData>(`/medical-records/${id}`)
      // LGPD: Art. 5º, II — dado sensível: atualiza apenas o estado local
      setMedicalRecord(updated.data)
      setShowRecordForm(false)
    } catch {
      setError('Erro ao registrar prontuário.')
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (error || !appointment) {
    return (
      <div className="flex min-h-screen items-center justify-center text-destructive">
        {error ?? 'Agendamento não encontrado.'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6 space-y-6">
      <Button variant="outline" size="sm" onClick={() => navigate('/appointments')}>
        ← Voltar
      </Button>

      {/* Dados do agendamento */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Consulta</CardTitle>
            {/* LGPD: Art. 5º, XIV — estado do ciclo de vida visível ao operador */}
            <Badge
              variant={
                appointment.status === 'scheduled'
                  ? 'default'
                  : appointment.status === 'completed'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {statusLabels[appointment.status]}
            </Badge>
          </div>
          <CardDescription>
            {new Date(appointment.scheduledAt).toLocaleString('pt-BR', {
              dateStyle: 'long',
              timeStyle: 'short',
            })}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            {/* LGPD: dado pessoal — Art. 5º, I */}
            <div>
              <p className="text-muted-foreground">Paciente (ID)</p>
              <p className="font-mono text-xs">{appointment.patientId}</p>
            </div>
            {/* LGPD: dado pessoal — Art. 5º, I */}
            <div>
              <p className="text-muted-foreground">Médico (ID)</p>
              <p className="font-mono text-xs">{appointment.doctorId}</p>
            </div>
          </div>

          {appointment.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground">Observações</p>
              <p>{appointment.notes}</p>
            </div>
          )}

          <Separator />

          {/* LGPD: Art. 6º, I — finalidade — prazo de retenção exibido ao operador */}
          <div className="text-sm">
            <p className="text-muted-foreground">Retenção obrigatória até (CFM)</p>
            <p>{new Date(appointment.retentionExpiresAt).toLocaleDateString('pt-BR')}</p>
          </div>

          {/* LGPD: Art. 5º, XIV — cancelamento preserva dados para retenção obrigatória */}
          {appointment.status === 'scheduled' &&
            (user?.role === 'receptionist' || user?.role === 'admin') && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancel}
                disabled={cancelLoading}
              >
                {cancelLoading ? 'Cancelando...' : 'Cancelar consulta'}
              </Button>
            )}
        </CardContent>
      </Card>

      {/* Prontuário médico — apenas para médico e admin */}
      {/* LGPD: Art. 5º, II e Art. 11 — dado sensível: visível apenas a roles autorizados */}
      {(user?.role === 'doctor' || user?.role === 'admin') && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prontuário</CardTitle>
            <CardDescription>
              LGPD Art. 5º, II — dado sensível de saúde; acesso registrado em audit_logs
            </CardDescription>
          </CardHeader>

          <CardContent>
            {medicalRecord ? (
              <div className="space-y-3 text-sm">
                {/* LGPD: dado sensível — Art. 5º, II */}
                {medicalRecord.diagnosis && (
                  <div>
                    <p className="text-muted-foreground">Diagnóstico</p>
                    <p>{medicalRecord.diagnosis}</p>
                  </div>
                )}
                {medicalRecord.icdCode && (
                  <div>
                    <p className="text-muted-foreground">CID</p>
                    <p>{medicalRecord.icdCode}</p>
                  </div>
                )}
                {medicalRecord.prescription && (
                  <div>
                    <p className="text-muted-foreground">Prescrição</p>
                    <p className="whitespace-pre-wrap">{medicalRecord.prescription}</p>
                  </div>
                )}
                {medicalRecord.clinicalNotes && (
                  <div>
                    <p className="text-muted-foreground">Notas clínicas</p>
                    <p className="whitespace-pre-wrap">{medicalRecord.clinicalNotes}</p>
                  </div>
                )}
                <Separator />
                <p className="text-xs text-muted-foreground">
                  Base legal: {medicalRecord.sensitiveLegalBasis} (Art. 11 LGPD) ·
                  Retenção até {new Date(medicalRecord.retentionExpiresAt).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ) : showRecordForm ? (
              // Formulário de criação de prontuário (doctor only)
              // LGPD: Art. 11 — acesso restrito ao médico responsável (RLS no backend)
              <form onSubmit={handleSubmit(onSubmitRecord)} className="space-y-4">
                <input type="hidden" {...register('appointmentId')} value={id} />
                <input type="hidden" {...register('sensitiveLegalBasis')} />

                <div className="space-y-1">
                  <Label htmlFor="diagnosis">Diagnóstico</Label>
                  {/* LGPD: dado sensível — Art. 5º, II */}
                  <Textarea id="diagnosis" {...register('diagnosis')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="icdCode">CID</Label>
                  {/* LGPD: dado sensível — Art. 5º, II */}
                  <Textarea id="icdCode" rows={1} {...register('icdCode')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="prescription">Prescrição</Label>
                  {/* LGPD: dado sensível — Art. 5º, II */}
                  <Textarea id="prescription" {...register('prescription')} />
                </div>

                <div className="space-y-1">
                  <Label htmlFor="clinicalNotes">Notas clínicas</Label>
                  {/* LGPD: dado sensível — Art. 5º, II */}
                  <Textarea id="clinicalNotes" {...register('clinicalNotes')} />
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setShowRecordForm(false)}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting}>
                    {isSubmitting ? 'Salvando...' : 'Salvar prontuário'}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Prontuário não registrado.</p>
                {/* Apenas o médico responsável pode criar o prontuário */}
                {user?.role === 'doctor' && appointment.status !== 'cancelled' && (
                  <Button size="sm" onClick={() => setShowRecordForm(true)}>
                    Registrar prontuário
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
