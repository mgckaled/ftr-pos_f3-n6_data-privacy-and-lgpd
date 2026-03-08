import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { insertAppointmentBodySchema, type InsertAppointmentBody } from '@medagenda/shared'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api'

// LGPD: Art. 6º, I — finalidade de atenção à saúde; consentimento já coletado no cadastro (Fase 2)
export function NewAppointment() {
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<InsertAppointmentBody>({
    resolver: zodResolver(insertAppointmentBodySchema),
  })

  async function onSubmit(data: InsertAppointmentBody) {
    setServerError(null)
    try {
      const res = await api.post<{ id: string }>('/appointments', data)
      navigate(`/appointments/${res.data.id}`)
    } catch {
      setServerError('Erro ao criar agendamento. Verifique os dados e tente novamente.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Nova Consulta</CardTitle>
          <CardDescription>
            Agendamento de consulta médica — retenção 20 anos (CFM nº 1.821/2007)
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* LGPD: dado pessoal — Art. 5º, I */}
            <div className="space-y-1">
              <Label htmlFor="patientId">ID do Paciente *</Label>
              <Input
                id="patientId"
                placeholder="UUID do paciente"
                {...register('patientId')}
              />
              {errors.patientId && (
                <p className="text-sm text-destructive">{errors.patientId.message}</p>
              )}
            </div>

            {/* LGPD: dado pessoal — Art. 5º, I */}
            <div className="space-y-1">
              <Label htmlFor="doctorId">ID do Médico *</Label>
              <Input
                id="doctorId"
                placeholder="UUID do médico"
                {...register('doctorId')}
              />
              {errors.doctorId && (
                <p className="text-sm text-destructive">{errors.doctorId.message}</p>
              )}
            </div>

            {/* LGPD: dado pessoal — Art. 5º, I — data/hora vincula titular a evento de saúde */}
            <div className="space-y-1">
              <Label htmlFor="scheduledAt">Data e hora *</Label>
              <Input
                id="scheduledAt"
                type="datetime-local"
                {...register('scheduledAt', {
                  setValueAs: (v: string) => (v ? new Date(v).toISOString() : v),
                })}
              />
              {errors.scheduledAt && (
                <p className="text-sm text-destructive">{errors.scheduledAt.message}</p>
              )}
            </div>

            {/* LGPD: dado pessoal — Art. 5º, I */}
            <div className="space-y-1">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                placeholder="Observações da recepcionista (opcional)"
                {...register('notes')}
              />
            </div>

            {serverError && <p className="text-sm text-destructive">{serverError}</p>}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => navigate('/appointments')}
              >
                Cancelar
              </Button>
              <Button type="submit" className="flex-1" disabled={isSubmitting}>
                {isSubmitting ? 'Agendando...' : 'Agendar consulta'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
