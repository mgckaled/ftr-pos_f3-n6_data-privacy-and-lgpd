<!-- markdownlint-disable -->

# project-state.md — MedAgenda LGPD

Estado do projeto após conclusão das Fases 1, 2 e 3.
Leia este documento antes de explorar o filesystem — ele evita tool calls desnecessárias.

---

## Fases concluídas

| Fase                                                   | Status | Módulo LGPD   |
| ------------------------------------------------------ | ------ | ------------- |
| Fase 1 — Fundação e controle de acesso                 | ✅      | Módulo 3      |
| Fase 2 — Cadastro de pacientes e consentimento         | ✅      | Módulos 1 e 4 |
| Fase 3 — Agendamento e ciclo de vida dos dados         | ✅      | Módulo 2      |
| Fase 4 — Segurança avançada e incidentes               | ⬜      | Módulos 3 e 5 |
| Fase 5 — Painel do titular e dashboard de conformidade | ⬜      | Módulos 5 e 6 |

---

## Banco de dados

### Migrations aplicadas

| Arquivo                        | Conteúdo                                                                               |
| ------------------------------ | -------------------------------------------------------------------------------------- |
| `0000_chemical_fallen_one.sql` | Setup inicial — schemas, extensões                                                     |
| `0001_gigantic_roughhouse.sql` | Tabelas users, audit_logs, RLS Fase 1                                                  |
| `0002_curly_red_hulk.sql`      | Tabelas patients, patient_tokens, consents, RLS Fase 2                                 |
| `0003_nice_marauders.sql`      | Enums novos, appointments, private.medical_records, view appointment_stats, RLS Fase 3 |

### Schemas definidos — `backend/src/db/schema/`

| Arquivo                | Tabela / Objeto                                                                                                                                  | Schema PG |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | --------- |
| `enums.ts`             | `roleEnum`, `legalBasisEnum`, `consentPurposeEnum`, `auditActionEnum`, `dataRequestTypeEnum`, `appointmentStatusEnum`, `sensitiveLegalBasisEnum` | —         |
| `users.ts`             | `users`                                                                                                                                          | public    |
| `patients.ts`          | `patients`                                                                                                                                       | public    |
| `patient-tokens.ts`    | `patientTokens`                                                                                                                                  | public    |
| `consents.ts`          | `consents`                                                                                                                                       | public    |
| `audit-logs.ts`        | `auditLogs`                                                                                                                                      | public    |
| `appointments.ts`      | `appointments`                                                                                                                                   | public    |
| `medical-records.ts`   | `medicalRecords`                                                                                                                                 | private   |
| `appointment-stats.ts` | `appointmentStats` (view materializada)                                                                                                          | public    |
| `index.ts`             | re-exporta tudo                                                                                                                                  | —         |

### Tabelas ainda não criadas (Fases 4 e 5)

- `data_requests` — direitos do titular Art. 18 (Fase 5)
- `incidents` — notificação ANPD Art. 48 (Fase 4)

---

## Backend — `backend/src/`

### Estrutura de módulos

```
modules/
├── auth/
│   ├── plugin.ts    — POST /auth/login, POST /auth/logout, GET /auth/me
│   ├── service.ts   — signIn, signOut, getMe
│   └── schema.ts    — loginBodySchema, authResponseSchema
├── patients/
│   ├── plugin.ts    — POST /patients, GET /patients, GET /patients/:id
│   ├── service.ts   — createPatient (atômico: patient + token + 5 consents + audit), listPatients, getPatient
│   └── schema.ts    — insertPatientBodySchema, patientResponseSchema
├── appointments/
│   ├── plugin.ts    — POST /appointments, GET /appointments, GET /appointments/:id, PATCH /appointments/:id/cancel, GET /appointments/stats
│   ├── service.ts   — createAppointment, listAppointments, getAppointment, cancelAppointment, getAppointmentStats
│   └── schema.ts    — appointmentResponseSchema, appointmentStatsResponseSchema
└── medical-records/
    ├── plugin.ts    — POST /medical-records, GET /medical-records/:appointmentId
    ├── service.ts   — createMedicalRecord, getMedicalRecord
    └── schema.ts    — insertMedicalRecordBodySchema, medicalRecordResponseSchema
```

### Middleware — `backend/src/middleware/`

| Arquivo    | Função                                                                    |
| ---------- | ------------------------------------------------------------------------- |
| `auth.ts`  | Extrai e valida JWT do httpOnly cookie via `jose`                         |
| `rbac.ts`  | `requireRole(...roles)` — bloqueia com 403 se role não autorizado         |
| `audit.ts` | Registra operações em `audit_logs` com `patientToken` (nunca `patientId`) |

### Lib — `backend/src/lib/`

| Arquivo  | Função                                                       |
| -------- | ------------------------------------------------------------ |
| `jwt.ts` | `signToken({ sub, role })` e `verifyToken(token)` via `jose` |

### Jobs — `backend/src/jobs/`

| Arquivo                | Schedule                | O que faz                                                                                                            |
| ---------------------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `retention-cleanup.ts` | `0 2 * * *` (diário 2h) | Hard delete appointments/patients expirados, anonimização de pacientes ativos expirados — sem RLS (processo interno) |

### Padrão arquitetural estabelecido

- `withRLS(userId, role, fn)` — envolve queries com `SET LOCAL app.user_id` e `app.user_role` para ativar RLS por sessão
- Todo service que acessa dados pessoais recebe `actorUserId`, `actorRole`, `ip` para audit log
- `retentionExpiresAt = now() + 20 anos` em appointments e medical_records (obrigação CFM)
- Audit log usa `patientToken` obtido via lookup em `patient_tokens` — nunca `patientId` diretamente

### Documentação OpenAPI

- `GET /documentation/json` — spec OpenAPI gerado pelo `@fastify/swagger`
- `GET /reference` — UI interativa Scalar (`@scalar/fastify-api-reference`)
- Tags definidas: `auth`, `patients`, `appointments`, `medical-records`
- Security scheme: `cookieAuth` (apiKey in cookie, name: `token`)

---

## Shared — `shared/src/`

| Arquivo                  | Exports                                                                       |
| ------------------------ | ----------------------------------------------------------------------------- |
| `schemas/patient.ts`     | `insertPatientBodySchema`, `InsertPatientBody`                                |
| `schemas/appointment.ts` | `insertAppointmentBodySchema`, `InsertAppointmentBody`, `appointmentStatuses` |
| `index.ts`               | re-exporta tudo de schemas/                                                   |

Pacote referenciado como `@medagenda/shared` via pnpm workspace.

---

## Frontend — `frontend/src/`

### Páginas implementadas

| Arquivo                                    | Rota                | Roles                       |
| ------------------------------------------ | ------------------- | --------------------------- |
| `pages/Login.tsx`                          | `/login`            | todos                       |
| `pages/patients/NewPatient.tsx`            | `/patients/new`     | receptionist                |
| `pages/patients/PatientDetail.tsx`         | `/patients/:id`     | doctor, receptionist        |
| `pages/appointments/AppointmentList.tsx`   | `/appointments`     | admin, doctor, receptionist |
| `pages/appointments/NewAppointment.tsx`    | `/appointments/new` | admin, receptionist         |
| `pages/appointments/AppointmentDetail.tsx` | `/appointments/:id` | admin, doctor, receptionist |

### Páginas ainda não implementadas (Fases 4 e 5)

- `/privacy` — painel do titular Art. 18 (Fase 5)
- `/admin` — dashboard DPO: audit_logs, data_requests, incidents (Fase 5)

### Infraestrutura frontend

| Arquivo                         | Função                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------- |
| `lib/api.ts`                    | Instância axios com `withCredentials: true` e `baseURL` do backend           |
| `contexts/AuthContext.tsx`      | `{ userId, role, name }` — JWT nunca em memória, populado via `GET /auth/me` |
| `contexts/ConsentContext.tsx`   | Estado do fluxo de consentimento em andamento                                |
| `components/ProtectedRoute.tsx` | Verifica `role` do `AuthContext`, redireciona se não autorizado              |

### Componentes shadcn/ui instalados

`badge`, `button`, `card`, `checkbox`, `input`, `label`, `separator`, `textarea`

---

## Seed — usuários disponíveis para teste

Definidos em `backend/src/db/seed.ts`:

| Email                   | Role         |
| ----------------------- | ------------ |
| `admin@medagenda.dev`   | admin        |
| `doctor@medagenda.dev`  | doctor       |
| `recep@medagenda.dev`   | receptionist |
| `patient@medagenda.dev` | patient      |

---

## O que a Fase 4 precisa adicionar

Referência rápida para não explorar o que já existe:

1. **Tabela `incidents`** — criar schema, migration, módulo completo
2. **Tabela `data_requests`** — criar schema (pode ser antecipada da Fase 5 se necessário)
3. **Criptografia `pgcrypto`** — aplicar em `medical_records` (diagnosis, prescription, clinicalNotes) e CPF em `patients` — os campos existem, falta a camada de criptografia nos services
4. **Endpoint de notificação de incidentes** — `POST /incidents` com rastreamento de prazo 72h (`notifiedAnpdAt`) referenciando Resolução CD/ANPD nº 15/2024
5. **Alerta de prazo** — lógica que sinaliza quando `notifiedAnpdAt` está a menos de 12h do limite de 72h desde `detectedAt`
6. **DPIA** — endpoint ou documento estruturado gerado pelo sistema
7. **Variáveis de ambiente** — auditoria de `.env` para garantir zero segredos hardcoded
