import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import {
  consentPurposeDescriptions,
  consentPurposes,
  insertPatientBodySchema,
  type InsertPatientBody,
} from '@medagenda/shared'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { api } from '@/lib/api'

// LGPD: Art. 8º, §2º — versão da política registrada como prova do consentimento
const POLICY_VERSION = '1.0'

type Step = 'personal' | 'consents'

export function NewPatient() {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('personal')
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<InsertPatientBody>({
    resolver: zodResolver(insertPatientBodySchema),
    defaultValues: {
      legalBasis: 'consent',
      // LGPD: Art. 8º — todos os 5 purposes declarados explicitamente; nenhum pré-marcado
      consents: consentPurposes.map((purpose) => ({
        purpose,
        granted: false,
        policyVersion: POLICY_VERSION,
      })),
    },
  })

  const consentValues = watch('consents')

  function handleConsentChange(index: number, granted: boolean) {
    const current = getValues('consents')
    const updated = current.map((c, i) => (i === index ? { ...c, granted } : c))
    setValue('consents', updated, { shouldValidate: true })
  }

  async function onSubmit(data: InsertPatientBody) {
    setServerError(null)
    try {
      await api.post('/patients', data)
      navigate('/appointments')
    } catch {
      setServerError('Erro ao cadastrar paciente. Tente novamente.')
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Novo Paciente</CardTitle>
            <Badge variant={step === 'personal' ? 'default' : 'secondary'}>
              {step === 'personal' ? 'Passo 1 de 2' : 'Passo 2 de 2'}
            </Badge>
          </div>
          <CardDescription>
            {step === 'personal'
              ? 'Dados pessoais do paciente'
              : 'Consentimentos por finalidade (Art. 8º LGPD)'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {step === 'personal' && (
              <>
                <div className="space-y-1">
                  <Label htmlFor="name">Nome completo *</Label>
                  <Input id="name" {...register('name')} />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="cpf">CPF (somente dígitos) *</Label>
                  <Input id="cpf" maxLength={11} {...register('cpf')} />
                  {errors.cpf && (
                    <p className="text-sm text-destructive">{errors.cpf.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="birthDate">Data de nascimento *</Label>
                  <Input id="birthDate" type="date" {...register('birthDate')} />
                  {errors.birthDate && (
                    <p className="text-sm text-destructive">{errors.birthDate.message}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" type="email" {...register('email')} />
                  {errors.email && (
                    <p className="text-sm text-destructive">{String(errors.email.message)}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input id="phone" {...register('phone')} />
                </div>

                <Button
                  type="button"
                  className="w-full"
                  onClick={() => setStep('consents')}
                >
                  Próximo: Consentimentos
                </Button>
              </>
            )}

            {step === 'consents' && (
              <>
                {/* LGPD: Art. 8º — informação clara sobre cada finalidade antes do consentimento */}
                <p className="text-sm text-muted-foreground">
                  Selecione as finalidades que o titular autoriza. Cada item pode ser
                  aceito ou recusado individualmente. Nenhum é obrigatório.
                </p>

                <Separator />

                <div className="space-y-4">
                  {consentPurposes.map((purpose, index) => (
                    <div key={purpose} className="flex items-start gap-3">
                      {/* LGPD: Art. 8º — nenhum checkbox pré-marcado; consentimento livre e inequívoco */}
                      <Checkbox
                        id={purpose}
                        checked={consentValues?.[index]?.granted ?? false}
                        onCheckedChange={(checked) =>
                          handleConsentChange(index, checked === true)
                        }
                      />
                      <div className="space-y-0.5">
                        <Label htmlFor={purpose} className="cursor-pointer font-medium">
                          {consentPurposeDescriptions[purpose]}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Política versão {POLICY_VERSION}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {errors.consents && (
                  <p className="text-sm text-destructive">
                    {typeof errors.consents === 'object' && 'message' in errors.consents
                      ? String(errors.consents.message)
                      : 'Erro nos consentimentos'}
                  </p>
                )}

                {serverError && (
                  <p className="text-sm text-destructive">{serverError}</p>
                )}

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setStep('personal')}
                  >
                    Voltar
                  </Button>
                  <Button type="submit" className="flex-1" disabled={isSubmitting}>
                    {isSubmitting ? 'Cadastrando...' : 'Cadastrar paciente'}
                  </Button>
                </div>
              </>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
