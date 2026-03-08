import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { api } from '@/lib/api'

interface AppointmentItem {
  id: string
  patientId: string // LGPD: dado pessoal — Art. 5º, I
  doctorId: string // LGPD: dado pessoal — Art. 5º, I
  scheduledAt: string // LGPD: dado pessoal — Art. 5º, I
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show'
  notes: string | null // LGPD: dado pessoal — Art. 5º, I
  deletedAt: string | null
  createdAt: string
}

const statusLabels: Record<AppointmentItem['status'], string> = {
  scheduled: 'Agendado',
  completed: 'Realizado',
  cancelled: 'Cancelado',
  no_show: 'Não compareceu',
}

const statusVariants: Record<
  AppointmentItem['status'],
  'default' | 'secondary' | 'destructive' | 'outline'
> = {
  scheduled: 'default',
  completed: 'secondary',
  cancelled: 'destructive',
  no_show: 'outline',
}

// LGPD: Art. 6º, X — cada acesso à lista gera audit_log no backend automaticamente
export function AppointmentList() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [appointments, setAppointments] = useState<AppointmentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<{ appointments: AppointmentItem[]; total: number }>('/appointments')
      .then((res) => setAppointments(res.data.appointments))
      .catch(() => setError('Erro ao carregar agendamentos.'))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-destructive">
        {error}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-4xl p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Agendamentos</h1>
          <p className="text-sm text-muted-foreground">
            {appointments.length} consulta{appointments.length !== 1 ? 's' : ''}
          </p>
        </div>
        {/* LGPD: Art. 6º, III — apenas recepcionista e admin criam agendamentos */}
        {(user?.role === 'receptionist' || user?.role === 'admin') && (
          <Button onClick={() => navigate('/appointments/new')}>Nova consulta</Button>
        )}
      </div>

      {appointments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum agendamento encontrado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {appointments.map((a) => (
            <Link key={a.id} to={`/appointments/${a.id}`} className="block">
              <Card className="transition-colors hover:bg-muted/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">
                      {/* LGPD: Art. 6º, III — exibe apenas ID do paciente na listagem */}
                      Paciente: <span className="font-mono text-sm">{a.patientId.slice(0, 8)}…</span>
                    </CardTitle>
                    {/* LGPD: Art. 5º, XIV — estado do ciclo de vida visível ao operador */}
                    <Badge variant={statusVariants[a.status]}>{statusLabels[a.status]}</Badge>
                  </div>
                  <CardDescription>
                    {new Date(a.scheduledAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </CardDescription>
                </CardHeader>
                {a.notes && (
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground">{a.notes}</p>
                  </CardContent>
                )}
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
