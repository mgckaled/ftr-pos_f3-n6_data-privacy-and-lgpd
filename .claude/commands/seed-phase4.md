# seed-phase4.md

Expanda o arquivo `backend/src/db/seed.ts` adicionando dados de teste para a Fase 4 e execute o seed.

**Importante:** não apague os usuários existentes (admin, doctor, receptionist, patient). Adicione apenas os novos dados abaixo, verificando com `SELECT COUNT(*)` se já existem antes de inserir para tornar o seed idempotente.

---

## 1. Pacientes com CPF válido

Crie 3 pacientes com CPFs válidos e distintos. Use CPFs de teste conhecidos como `'529.982.247-25'`, `'111.444.777-35'` e `'371.274.628-60'` — válidos pelo algoritmo mas não atribuídos a pessoas reais. Vincule cada paciente ao `userId` do `patient@medagenda.dev` ou deixe `userId: null` se for paciente sem login.

Para cada paciente, defina:

- `legalBasis: 'consent'`
- `retentionExpiresAt`: `now() + 20 anos` para 2 pacientes, e `now() - 1 day` para 1 paciente (simula dado vencido)
- `deletedAt: null` para todos inicialmente

Após inserir cada paciente, insira o respectivo `patientToken` em `patient_tokens` com um UUID v4 gerado.

---

## 2. Consents em estados variados

Para cada paciente criado, insira consents cobrindo todos os valores de `consentPurposeEnum`:

- `medical_treatment`: `granted: true` para todos
- `data_sharing_partners`: `granted: true` para 2 pacientes, `granted: false, revokedAt: now()` para 1 paciente
- `research`: `granted: false` para todos
- `insurance`: `granted: true` para 1 paciente, `granted: false` para os outros 2
- `marketing`: `granted: false` para todos

Preencha `ipAddress: '127.0.0.1'` e `policyVersion: '1.0'` em todos.

---

## 3. Appointments em estados variados

Crie 6 appointments distribuídos assim, todos com `doctorId` do `doctor@medagenda.dev`:

| #   | patientId  | status      | scheduledAt       | retentionExpiresAt | deletedAt       |
| --- | ---------- | ----------- | ----------------- | ------------------ | --------------- |
| 1   | paciente 1 | `completed` | `now() - 30 dias` | `now() + 20 anos`  | null            |
| 2   | paciente 1 | `completed` | `now() - 15 dias` | `now() + 20 anos`  | null            |
| 3   | paciente 2 | `scheduled` | `now() + 7 dias`  | `now() + 20 anos`  | null            |
| 4   | paciente 2 | `cancelled` | `now() - 5 dias`  | `now() + 20 anos`  | null            |
| 5   | paciente 3 | `completed` | `now() - 60 dias` | `now() - 1 day`    | `now() - 1 day` |
| 6   | paciente 3 | `no_show`   | `now() - 90 dias` | `now() - 1 day`    | null            |

O appointment 5 tem `deletedAt` preenchido + `retentionExpiresAt` vencido → deve ser hard deleted pelo job.
O appointment 6 tem `deletedAt: null` + `retentionExpiresAt` vencido → não deve ser deletado (só anonimizado via paciente).

---

## 4. Medical records com conteúdo realista

Para os appointments 1, 2 e 5 (status `completed`), insira registros em `private.medical_records`:

**Appointment 1:**

- `diagnosis`: `'Hipertensão arterial sistêmica leve'`
- `prescription`: `'Losartana 50mg — 1 comprimido ao dia em jejum'`
- `clinicalNotes`: `'Paciente relata cefaleia ocasional. PA: 145/90 mmHg. Recomendado controle de sódio e atividade física regular.'`
- `icdCode`: `'I10'`
- `sensitiveLegalBasis`: `'health_care'`
- `retentionExpiresAt`: `now() + 20 anos`

**Appointment 2:**

- `diagnosis`: `'Diabetes mellitus tipo 2 — diagnóstico inicial'`
- `prescription`: `'Metformina 500mg — 1 comprimido com o almoço e jantar'`
- `clinicalNotes`: `'Glicemia em jejum: 142 mg/dL. HbA1c: 7.2%. Orientado sobre dieta e monitoramento domiciliar.'`
- `icdCode`: `'E11'`
- `sensitiveLegalBasis`: `'health_care'`
- `retentionExpiresAt`: `now() + 20 anos`

**Appointment 5:**

- `diagnosis`: `'Infecção do trato urinário'`
- `prescription`: `'Nitrofurantoína 100mg — 2x ao dia por 7 dias'`
- `clinicalNotes`: `'Urocultura positiva para E. coli. Paciente alérgica a sulfonamidas — registrado.'`
- `icdCode`: `'N39.0'`
- `sensitiveLegalBasis`: `'health_care'`
- `retentionExpiresAt`: `now() - 1 day`  ← vencido junto com o appointment

---

## 5. Paciente com retenção vencida e sem deletedAt

Atualize o paciente 3 para ter `retentionExpiresAt: now() - 1 day` e `deletedAt: null`. Isso simula o cenário de anonimização: o job deve anonimizar os campos pessoais sem deletar a linha, preservando o histórico de appointments.

---

## 6. Executar o seed

Após expandir o `seed.ts`, execute:

```bash
pnpm --filter backend db:seed
```

Confirme no terminal que os registros foram inseridos sem erros. Se o comando não existir em `package.json`, adicione:

```json
"db:seed": "tsx src/db/seed.ts"
```

---

## Verificação

Ao final, exiba uma tabela resumindo quantos registros foram inseridos em cada tabela:

- `patients` — total e quantos com `retentionExpiresAt` vencido
- `consents` — total e quantos com `revokedAt` preenchido
- `appointments` — total por status
- `private.medical_records` — total
- `patient_tokens` — total
