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
| Fase 4 — Segurança avançada e incidentes               | ✅      | Módulos 3 e 5 |
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
| `0004_phase4_incidents.sql`    | Enums incident_severity/status, tabela incidents, RLS Fase 4                           |

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
| `incidents.ts`         | `incidents` — notificação de incidentes Art. 48 + prazo 72h ANPD                                                                                | public    |
| `index.ts`             | re-exporta tudo                                                                                                                                  | —         |

### Tabelas ainda não criadas (Fase 5)

- `data_requests` — direitos do titular Art. 18 (Fase 5)

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
├── medical-records/
│   ├── plugin.ts    — POST /medical-records, GET /medical-records/:appointmentId
│   ├── service.ts   — createMedicalRecord (encrypt pgcrypto), getMedicalRecord (decrypt raw SQL)
│   └── schema.ts    — insertMedicalRecordBodySchema, medicalRecordResponseSchema
├── incidents/
│   ├── plugin.ts    — POST /incidents, GET /incidents, GET /incidents/:id, PATCH /incidents/:id/notify-anpd
│   ├── service.ts   — createIncident, listIncidents, getIncident, notifyAnpd + computeAnpdAlert (72h)
│   └── schema.ts    — insertIncidentBodySchema, incidentResponseSchema, incidentListResponseSchema
└── dpia/
    └── plugin.ts    — GET /dpia (documento DPIA estruturado — LGPD Art. 38)
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

## O que a Fase 4 adicionou ✅

1. **Tabela `incidents`** — schema, migration `0004_phase4_incidents.sql`, módulo completo
2. **Criptografia `pgcrypto`** — `lib/pgcrypto.ts`; CPF em `patients`, diagnosis/prescription/clinicalNotes em `medical_records`
3. **Módulo incidents** — `POST /incidents`, `GET /incidents`, `GET /incidents/:id`, `PATCH /incidents/:id/notify-anpd`
4. **Alerta de prazo 72h** — `computeAnpdAlert()` retorna `anpdAlertStatus`: compliant | pending | urgent | overdue
5. **DPIA** — `GET /dpia` gera documento estruturado (ISO/IEC 29134, Art. 38 LGPD)
6. **`.env.example`** — todas as variáveis documentadas; `PGCRYPTO_KEY` explicitado
7. **Script de migração** — `db:encrypt-existing` criptografa dados existentes (idempotente via prefixo "hQ")

## O que a Fase 5 precisa adicionar

1. **Tabela `data_requests`** — fila de direitos do titular Art. 18
2. **Painel do titular** (`/privacy`) — visualizar, corrigir, exportar, revogar, solicitar exclusão
3. **Dashboard DPO** (`/admin`) — fila de data_requests com SLA, lista de incidents com urgentCount
4. **ROPA** — gerado automaticamente a partir dos audit_logs
5. **Relatório de conformidade exportável** como evidência auditável
