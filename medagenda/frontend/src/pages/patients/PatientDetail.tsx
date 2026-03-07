import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'

interface PatientData {
  id: string
  name: string
  email: string | null
  phone: string | null
  birthDate: string | null
  legalBasis: string
  retentionExpiresAt: string | null
  anonymizedAt: string | null
  deletedAt: string | null
  createdAt: string
}

// LGPD: Art. 6º, X — cada acesso a este componente registra audit_log no backend
export function PatientDetail() {
  const { id } = useParams<{ id: string }>()
  const [patient, setPatient] = useState<PatientData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    api
      .get<PatientData>(`/patients/${id}`)
      .then((res) => setPatient(res.data))
      .catch(() => setError('Paciente não encontrado ou sem permissão de acesso.'))
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    )
  }

  if (error || !patient) {
    return (
      <div className="flex min-h-screen items-center justify-center text-destructive">
        {error ?? 'Paciente não encontrado.'}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{patient.name}</CardTitle>
            {/* LGPD: Art. 5º, XIV — indica visualmente se o registro foi eliminado */}
            {patient.deletedAt ? (
              <Badge variant="destructive">Excluído</Badge>
            ) : patient.anonymizedAt ? (
              <Badge variant="secondary">Anonimizado</Badge>
            ) : (
              <Badge variant="default">Ativo</Badge>
            )}
          </div>
          <CardDescription>
            Base legal: <strong>{patient.legalBasis}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">E-mail</p>
              <p>{patient.email ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Telefone</p>
              <p>{patient.phone ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Data de nascimento</p>
              <p>{patient.birthDate ?? '—'}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Cadastrado em</p>
              <p>{new Date(patient.createdAt).toLocaleDateString('pt-BR')}</p>
            </div>
          </div>

          <Separator />

          {/* LGPD: Art. 6º, I — finalidade — exibe o prazo de retenção ao operador */}
          <div className="text-sm">
            <p className="text-muted-foreground">Retenção dos dados até</p>
            <p>
              {patient.retentionExpiresAt
                ? new Date(patient.retentionExpiresAt).toLocaleDateString('pt-BR')
                : '—'}
            </p>
          </div>

          {/* CPF é omitido intencionalmente — princípio da necessidade (Art. 6º, III) */}
        </CardContent>
      </Card>
    </div>
  )
}
