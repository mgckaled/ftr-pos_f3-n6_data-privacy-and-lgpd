# MedAgenda — Backend

API REST do sistema de agendamento médico com conformidade à LGPD (Lei nº 13.709/2018).

## Stack

| Tecnologia | Versão / Detalhe |
| --- | --- |
| Runtime | Node.js + TypeScript (ESM) |
| Framework | Fastify + `fastify-type-provider-zod` |
| ORM | Drizzle ORM + drizzle-kit |
| Banco de dados | PostgreSQL 16 (dois schemas: `public` e `private`) |
| Validação | Zod + `drizzle-zod` |
| Autenticação | JWT via `jose` — HS256, expiração 1h, cookie `httpOnly` |
| Hash de senha | bcryptjs (rounds = 12) |
| Criptografia em repouso | pgcrypto (`pgp_sym_encrypt` / `pgp_sym_decrypt`) — Fase 4 |
| API Docs | `@fastify/swagger` + `@scalar/fastify-api-reference` |
| Job de retenção | `node-cron` — limpeza diária às 02h |
| Containers | Docker + Docker Compose |

## Estrutura de diretórios

```plaintext
src/
├── db/
│   ├── index.ts                   # pool pg + instância drizzle + helper withRLS()
│   ├── seed.ts                    # usuários iniciais de cada role
│   ├── encrypt-existing-data.ts   # migra dados pré-Fase 4 para criptografia em repouso
│   ├── migrations/                # SQL gerado pelo drizzle-kit
│   └── schema/
│       ├── enums.ts               # todos os pgEnum do projeto
│       ├── users.ts
│       ├── audit-logs.ts
│       ├── patients.ts
│       ├── patient-tokens.ts
│       ├── consents.ts
│       ├── appointments.ts
│       ├── medical-records.ts
│       ├── appointment-stats.ts
│       ├── incidents.ts           # Fase 4 — notificação ANPD Art. 48
│       └── index.ts
├── jobs/
│   └── retention-cleanup.ts       # cron diário — hard delete, anonimização
├── lib/
│   ├── jwt.ts                     # signJWT / verifyJWT
│   └── pgcrypto.ts                # Fase 4 — encryptField() / getDecryptionKey()
├── middleware/
│   ├── auth.ts                    # extrai JWT do cookie; popula request.user
│   ├── rbac.ts                    # requireRole(...roles) — 403 + audit em negações
│   └── audit.ts                   # recordAudit() — helper para registrar operações
└── modules/
    ├── auth/
    │   ├── plugin.ts              # POST /auth/login, GET /auth/me, POST /auth/logout
    │   ├── service.ts
    │   └── schema.ts
    ├── patients/
    │   ├── plugin.ts              # POST /patients, GET /patients, GET /patients/:id
    │   ├── service.ts             # CPF criptografado no INSERT (Fase 4)
    │   └── schema.ts
    ├── appointments/
    │   ├── plugin.ts              # CRUD de agendamentos + stats anonimizadas
    │   ├── service.ts
    │   └── schema.ts
    ├── medical-records/
    │   ├── plugin.ts              # POST e GET /medical-records
    │   ├── service.ts             # campos sensíveis criptografados INSERT/decrypt SELECT (Fase 4)
    │   └── schema.ts
    ├── incidents/                 # Fase 4 — Art. 48 + Resolução CD/ANPD nº 15/2024
    │   ├── plugin.ts              # POST, GET, GET/:id, PATCH/:id/notify-anpd
    │   ├── service.ts             # lógica de negócio + alerta de prazo 72h
    │   └── schema.ts              # insertIncidentBodySchema, incidentResponseSchema
    └── dpia/                      # Fase 4 — Art. 38
        └── plugin.ts              # GET /dpia — documento DPIA estruturado
```

## Banco de dados

### Schemas PostgreSQL

- `public` — dados pessoais comuns (Art. 5º, I) e tabelas de conformidade
- `private` — dados sensíveis de saúde (Art. 5º, II) com RLS próprio

### Tabelas implementadas

#### `users`

Agentes do sistema. Campo `role` controla RBAC e políticas RLS.

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `id` | uuid PK | Identificador interno |
| `name` | text | Nome do agente |
| `email` | text unique | E-mail de acesso |
| `passwordHash` | text | bcrypt rounds=12 |
| `role` | enum | `admin`, `doctor`, `receptionist`, `patient` |
| `deletedAt` | timestamp | Soft delete |
| `createdAt` | timestamp | Criação |
| `updatedAt` | timestamp | Última alteração |

#### `patients`

Titulares dos dados. Núcleo do modelo de privacidade.

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | Identificador interno |
| `userId` | uuid FK nullable | Vínculo com `users` — criado apenas quando o titular solicita acesso ao painel |
| `name` | text | Dado pessoal — Art. 5º, I |
| `email` | text | Dado pessoal — Art. 5º, I |
| `phone` | text | Dado pessoal — Art. 5º, I |
| `birthDate` | date | Dado pessoal — Art. 5º, I |
| `cpf` | text | Dado pessoal — Art. 5º, I — **criptografado em repouso** via `pgp_sym_encrypt` (Fase 4) |
| `legalBasis` | enum | Base legal do Art. 7º que justifica o tratamento |
| `retentionExpiresAt` | timestamp | Prazo de retenção (5 anos — base: consentimento) |
| `anonymizedAt` | timestamp | Data de anonimização — Art. 5º, XI |
| `deletedAt` | timestamp | Soft delete — Art. 5º, XIV |

#### `appointments`

Consultas agendadas. Retenção obrigatória de 20 anos (CFM nº 1.821/2007).

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | Identificador interno |
| `patientId` | uuid FK | Dado pessoal — Art. 5º, I |
| `doctorId` | uuid FK | Dado pessoal — Art. 5º, I |
| `scheduledAt` | timestamp | Dado pessoal — Art. 5º, I |
| `status` | enum | `scheduled`, `completed`, `cancelled`, `no_show` — Art. 5º, XIV |
| `notes` | text | Dado pessoal — Art. 5º, I |
| `retentionExpiresAt` | timestamp | Prazo legal: 20 anos (CFM) — Art. 6º, I |
| `deletedAt` | timestamp | Soft delete — Art. 5º, XIV |

#### `private.medical_records`

Prontuários médicos. Isolados no schema `private` com RLS restrito ao médico autor.
Todos os campos sensíveis são **criptografados em repouso** via `pgp_sym_encrypt` (Fase 4).

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | Identificador interno |
| `appointmentId` | uuid FK unique | Vínculo 1:1 com a consulta |
| `patientId` | uuid FK | Dado pessoal — Art. 5º, I |
| `doctorId` | uuid FK | Médico responsável — controla acesso RLS |
| `diagnosis` | text | Dado sensível — Art. 5º, II — **criptografado em repouso** |
| `prescription` | text | Dado sensível — Art. 5º, II — **criptografado em repouso** |
| `clinicalNotes` | text | Dado sensível — Art. 5º, II — **criptografado em repouso** |
| `icdCode` | text | Dado sensível — Art. 5º, II |
| `sensitiveLegalBasis` | enum | Base legal Art. 11 (`health_care`, `vital_interest`, `research_anonymized`, `legal_obligation`) |
| `retentionExpiresAt` | timestamp | Prazo legal: 20 anos (CFM) — Art. 6º, I |

#### `patient_tokens`

Mapeamento de pseudonimização. Acesso restrito a `admin` via RLS.

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | — |
| `patientId` | uuid FK | Referência ao titular |
| `token` | text unique | UUID aleatório — substitui `patientId` nos `audit_logs` |
| `createdAt` | timestamp | — |

#### `consents`

Registro imutável de consentimentos por finalidade.

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | — |
| `patientId` | uuid FK | Titular |
| `purpose` | enum | Uma das 5 finalidades do `consentPurposeEnum` |
| `granted` | boolean | Aceite ou recusa da finalidade |
| `grantedAt` | timestamp | Prova temporal — Art. 8º, §2º |
| `revokedAt` | timestamp | Data de revogação — Art. 8º, §5º |
| `ipAddress` | text | IP como evidência do consentimento — Art. 8º, §2º |
| `policyVersion` | text | Versão da política vigente no ato do consentimento |

#### `audit_logs`

Imutável. Sem `updatedAt` nem `deletedAt`. Registra toda operação sobre dados pessoais.

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | — |
| `userId` | uuid FK | Agente que realizou a ação |
| `patientToken` | text | Token de pseudonimização — nunca `patientId` direto |
| `action` | enum | `create`, `read`, `update`, `delete`, `export`, `login`, `logout`, `consent_grant`, `consent_revoke`, `data_request`, `incident_report` |
| `resource` | text | Tabela/recurso afetado |
| `resourceId` | text | ID do registro afetado |
| `legalBasis` | enum | Base legal da operação auditada |
| `ipAddress` | text | IP do agente |
| `userAgent` | text | User-agent do cliente |
| `metadata` | jsonb | Dados contextuais adicionais |
| `createdAt` | timestamp | Timestamp imutável |

#### `incidents` — Fase 4

Notificação de incidentes de segurança. Art. 48 LGPD + Resolução CD/ANPD nº 15/2024.
Acesso exclusivo ao admin/DPO via RLS `incidents_admin_only`.

| Campo | Tipo | Descrição LGPD |
| --- | --- | --- |
| `id` | uuid PK | Identificador interno |
| `title` | text NOT NULL | Título descritivo do incidente |
| `description` | text | Narrativa detalhada — Art. 48, §1º |
| `severity` | enum | `low`, `medium`, `high`, `critical` |
| `status` | enum | `open` → `notified` → `resolved` |
| `detectedAt` | timestamp | **Marco zero do prazo de 72h** — Resolução CD/ANPD nº 15/2024 |
| `notifiedAnpdAt` | timestamp | Prova do cumprimento do prazo; `null` = pendente |
| `affectedCount` | integer | Estimativa de titulares afetados — Art. 48, §1º, I |
| `affectedResources` | text[] | Categorias de dados / sistemas comprometidos — Art. 48, §1º, II |
| `containmentMeasures` | text | Medidas de contenção adotadas — Art. 48, §1º, III |
| `reportedBy` | uuid FK | Admin que registrou o incidente |
| `createdAt` | timestamp | Rastreabilidade |
| `updatedAt` | timestamp | Rastreabilidade |

#### View materializada `appointment_stats`

Estatísticas anonimizadas de agendamentos por mês — sem nenhum identificador pessoal (Art. 5º, XI).

| Campo | Tipo | Descrição |
| --- | --- | --- |
| `month` | text | Mês truncado (`date_trunc('month', ...)`) |
| `total` | int | Total de agendamentos no mês |
| `completed` | int | Agendamentos realizados |
| `cancelled` | int | Agendamentos cancelados |
| `noShow` | int | Não comparecimentos |

### Enums

| Enum | Valores |
| --- | --- |
| `roleEnum` | `admin`, `doctor`, `receptionist`, `patient` |
| `legalBasisEnum` | `consent`, `legal_obligation`, `contract`, `legitimate_interest`, `vital_interest`, `health_care`, `research` |
| `sensitiveLegalBasisEnum` | `health_care`, `vital_interest`, `research_anonymized`, `legal_obligation` |
| `appointmentStatusEnum` | `scheduled`, `completed`, `cancelled`, `no_show` |
| `consentPurposeEnum` | `medical_treatment`, `data_sharing_partners`, `research`, `insurance`, `marketing` |
| `auditActionEnum` | `create`, `read`, `update`, `delete`, `export`, `login`, `logout`, `consent_grant`, `consent_revoke`, `data_request`, `incident_report` |
| `incidentSeverityEnum` | `low`, `medium`, `high`, `critical` |
| `incidentStatusEnum` | `open`, `notified`, `resolved` |

### RLS (Row Level Security)

Políticas por role definidas com `pgPolicy` no schema Drizzle e geradas automaticamente pelo drizzle-kit. O contexto de sessão é injetado via `set_config()` em cada transação:

```sql
SELECT set_config('app.current_user_id', '<userId>', true);
SELECT set_config('app.current_role',    '<role>',   true);
```

| Tabela | admin | doctor | receptionist | patient |
| --- | --- | --- | --- | --- |
| `users` | all | próprio | próprio | próprio |
| `audit_logs` | all | próprios | próprios | próprios |
| `patients` | all | select | all | próprio (via `userId`) |
| `patient_tokens` | all | — | — | — |
| `consents` | all | — | all | próprios |
| `appointments` | all | select (próprios) | all | — |
| `private.medical_records` | select | all (próprios) | — | — |
| `incidents` | all | — | — | — |

## Endpoints

### Auth (`/auth`)

| Método | Rota | Role | Descrição |
| --- | --- | --- | --- |
| `POST` | `/auth/login` | público | Login; define cookie `httpOnly` com JWT |
| `GET` | `/auth/me` | autenticado | Retorna `{ userId, role, name }` |
| `POST` | `/auth/logout` | autenticado | Limpa cookie; registra em `audit_logs` |

### Patients (`/patients`)

| Método | Rota | Role | Descrição LGPD |
| --- | --- | --- | --- |
| `POST` | `/patients` | admin, receptionist | Cadastro atômico: patient + token + consents + audit; CPF criptografado |
| `GET` | `/patients` | admin, doctor, receptionist | Lista sem CPF (Art. 6º, III — necessidade) |
| `GET` | `/patients/:id` | admin, doctor, receptionist | Detalhe; registra acesso em `audit_logs` (Art. 6º, X) |

### Appointments (`/appointments`)

| Método | Rota | Role | Descrição LGPD |
| --- | --- | --- | --- |
| `POST` | `/appointments` | admin, receptionist | Cria agendamento; retenção 20 anos (CFM) |
| `GET` | `/appointments` | admin, doctor, receptionist | Lista — doctor vê apenas as suas (RLS) |
| `GET` | `/appointments/:id` | admin, doctor, receptionist | Detalhe; registra acesso em `audit_logs` |
| `PATCH` | `/appointments/:id/cancel` | admin, doctor, receptionist | Soft delete; registra em `audit_logs` |
| `GET` | `/appointments/stats` | admin | Estatísticas anonimizadas — view materializada (Art. 5º, XI) |

### Medical Records (`/medical-records`)

| Método | Rota | Role | Descrição LGPD |
| --- | --- | --- | --- |
| `POST` | `/medical-records` | doctor | Cria prontuário; campos sensíveis criptografados via pgcrypto (Art. 11) |
| `GET` | `/medical-records/:appointmentId` | admin, doctor | Lê prontuário com descriptografia; registra acesso em `audit_logs` |

### Incidents (`/incidents`) — Fase 4

| Método | Rota | Role | Descrição LGPD |
| --- | --- | --- | --- |
| `POST` | `/incidents` | admin | Registra incidente; inicia contagem do prazo de 72h (Resolução CD/ANPD nº 15/2024) |
| `GET` | `/incidents` | admin | Lista com `anpdAlertStatus` calculado em tempo real e `urgentCount` |
| `GET` | `/incidents/:id` | admin | Detalhe com prazo restante em horas |
| `PATCH` | `/incidents/:id/notify-anpd` | admin | Seta `notifiedAnpdAt`; muda status para `notified`; idempotente |

#### Campo `anpdAlertStatus`

Calculado dinamicamente a partir de `detectedAt` e `notifiedAnpdAt`:

| Valor | Condição |
| --- | --- |
| `compliant` | `notifiedAnpdAt IS NOT NULL` |
| `pending` | Não notificado; mais de 12h restantes |
| `urgent` | Não notificado; menos de 12h restantes |
| `overdue` | Não notificado; prazo de 72h vencido |

### DPIA (`/dpia`) — Fase 4

| Método | Rota | Role | Descrição LGPD |
| --- | --- | --- | --- |
| `GET` | `/dpia` | admin | Gera DPIA estruturado — Art. 38; estrutura conforme boas práticas ISO/IEC 29134 |

O documento retorna: atividades de tratamento com base legal, medidas técnicas e organizacionais,
referências legais e `nextReviewAt`. Gerado dinamicamente com `generatedAt` como evidência auditável.

> **Nota:** implementação didática — requer validação jurídica para uso em DPIA oficial.

## Criptografia em repouso — Fase 4

`src/lib/pgcrypto.ts` fornece helpers para uso do `pgcrypto` PostgreSQL nos services:

```typescript
// INSERT — fragment SQL aceito pelo Drizzle runtime
import { encryptField } from '../../lib/pgcrypto.js'

cpf: encryptField(body.cpf) as unknown as string

// SELECT — query raw com RLS ativo na mesma transação
import { getDecryptionKey } from '../../lib/pgcrypto.js'

await client.query(
  `SELECT pgp_sym_decrypt(decode(diagnosis, 'base64'), $1)::text AS diagnosis
   FROM private.medical_records WHERE appointment_id = $2`,
  [getDecryptionKey(), appointmentId],
)
```

Mensagens OpenPGP em base64 sempre começam com `hQ` — prefixo usado para detectar dados
já criptografados no script de migração (`db:encrypt-existing`).

## Job de retenção

`src/jobs/retention-cleanup.ts` — executado diariamente às 02h via `node-cron`.

Distingue explicitamente três operações (Art. 5º, XIV e Art. 5º, XI):

| Operação | Condição | O que faz |
| --- | --- | --- |
| **Hard delete** | `deletedAt IS NOT NULL AND retentionExpiresAt < NOW()` | `DELETE` — eliminação real permanente |
| **Soft delete** | `deletedAt` preenchido | Acesso bloqueado; dado preservado até prazo |
| **Anonimização** | `deletedAt IS NULL AND retentionExpiresAt < NOW()` | `UPDATE` campos pessoais para `[anonimizado]`; linha preservada |

Todas as operações registradas em `audit_logs` com `legalBasis: 'legal_obligation'`.

## Documentação OpenAPI

`@fastify/swagger` gera o spec internamente. `@scalar/fastify-api-reference` o serve:

| URL | Descrição |
| --- | --- |
| `GET /reference` | Scalar UI interativa (6 tags: auth, patients, appointments, medical-records, incidents, dpia) |
| `GET /reference/openapi.json` | Spec OpenAPI em JSON |
| `GET /reference/openapi.yaml` | Spec OpenAPI em YAML |

> `@fastify/swagger` v8+ não expõe rotas HTTP próprias — as rotas de spec são registradas pelo Scalar.

## Autenticação e segurança

- JWT carrega `{ sub: userId, role, iat, exp }` — expiração de 1h, sem refresh tokens
- Token exclusivamente em cookie `httpOnly; SameSite=Strict; Path=/` — nunca exposto ao JavaScript
- Middleware `authenticate` valida assinatura e expiração antes de qualquer rota protegida
- `requireRole(...roles)` rejeita com 403 e registra tentativa em `audit_logs`

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha antes de iniciar o servidor.
Nenhum segredo deve ser hardcoded no código-fonte (LGPD Art. 46).

```env
DATABASE_URL=postgresql://user:pass@localhost:5432/medagenda
JWT_SECRET=<string longa e aleatória — mínimo 32 chars>
PGCRYPTO_KEY=<chave de criptografia simétrica — mínimo 32 chars>
FRONTEND_URL=http://localhost:5173
```

> **Atenção:** a perda da `PGCRYPTO_KEY` torna irrecuperáveis todos os dados criptografados
> (CPF e campos sensíveis de `medical_records`). Armazene-a com segurança em produção.

## Scripts

```bash
pnpm dev                  # servidor em modo watch (tsx watch)
pnpm build                # compila TypeScript
pnpm db:generate          # drizzle-kit generate — gera migration a partir do schema
pnpm db:migrate           # drizzle-kit migrate — aplica migrations pendentes
pnpm db:seed              # popula banco com usuários de cada role
pnpm db:encrypt-existing  # migra dados pré-Fase 4 para criptografia em repouso (idempotente)
pnpm db:studio            # drizzle-kit studio — UI visual do banco
```

## Seed

Cria um usuário por role para testes:

| Role | E-mail | Senha |
| --- | --- | --- |
| admin | `admin@medagenda.dev` | `Admin@123` |
| doctor | `doctor@medagenda.dev` | `Doctor@123` |
| receptionist | `recep@medagenda.dev` | `Recep@123` |
| patient | `patient@medagenda.dev` | `Patient@123` |

## Convenção de comentários LGPD

Todo campo ou bloco de código que implementa um requisito da LGPD possui comentário na linha anterior:

```typescript
// LGPD: Art. 8º, §2º — prova do consentimento recai sobre o controlador
grantedAt: timestamp('granted_at').notNull().defaultNow(),
```

Um hook `PostToolUse` (`.claude/hooks/check-lgpd-comments.js`) valida automaticamente que todo campo Drizzle declarado possui o comentário correspondente.
