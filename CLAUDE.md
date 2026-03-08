# CLAUDE.md — MedAgenda LGPD

## Propósito

Projeto didático para estudo aplicado da Lei nº 13.709/2018 (LGPD) através de um sistema de agendamento de consultas médicas. O domínio de negócio é simples e secundário — o protagonista é a conformidade. Cada decisão técnica relevante deve conter um comentário no código referenciando o artigo ou princípio da LGPD que a justifica.

> **Antes de explorar o filesystem**, leia `.claude/docs/project-state.md` — ele mapeia todos os arquivos existentes, tabelas, módulos, padrões arquiteturais e o que cada fase ainda precisa implementar. Evita tool calls desnecessárias de exploração.

---

## Stack

| Camada            | Tecnologia                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------------- |
| Package manager   | pnpm (workspaces — monorepo backend + frontend)                                               |
| Runtime           | Node.js + TypeScript                                                                          |
| Framework backend | Fastify + `@fastify/type-provider-zod`                                                        |
| ORM               | Drizzle ORM (`drizzle-orm`, `drizzle-kit`)                                                    |
| Validação         | Zod + `drizzle-zod` + `@fastify/type-provider-zod` (validação no nível da rota)               |
| Auth              | JWT via `jose` — expiração de 1h, sem refresh tokens                                          |
| API Docs          | `@fastify/swagger` + `@scalar/fastify-api-reference` (UI em `/reference`, a partir da Fase 3) |
| Banco de dados    | PostgreSQL 16 (dois schemas: `public` e `private`)                                            |
| Frontend          | Vite (`react-ts` template) + React + TypeScript + Tailwind CSS + shadcn/ui                    |
| Formulários       | `react-hook-form` + `@hookform/resolvers/zod`                                                 |
| HTTP client       | axios (instância centralizada em `src/lib/api.ts`)                                            |
| Estado global     | React Context (`AuthContext` + `ConsentContext`)                                              |
| Auth storage      | `httpOnly` cookie — JWT nunca em `localStorage`                                               |
| Containers        | Docker + Docker Compose                                                                       |

---

## Arquitetura de dados

Dois schemas PostgreSQL com semântica LGPD explícita:

- `public` — dados pessoais comuns (Art. 5º, I) e todas as tabelas de conformidade
- `private` — exclusivamente dados sensíveis de saúde (Art. 5º, II), com RLS próprio

### Tabelas

**Schema `public`**

- `users` — agentes do sistema (admin, doctor, receptionist, patient); campo `role` usado no RBAC e nas políticas RLS
- `patients` — titulares dos dados; campos `legalBasis`, `retentionExpiresAt`, `anonymizedAt`, `deletedAt`; CPF armazenado criptografado via `pgcrypto`
- `patient_tokens` — mapeamento de pseudonimização; acesso restrito a admin/dpo via RLS; usado nos audit_logs no lugar do `patient_id`
- `appointments` — consultas agendadas; campo `retentionExpiresAt` independente do paciente (obrigação CFM: 20 anos)
- `consents` — consentimento por finalidade específica (nunca genérico); campos `grantedAt`, `revokedAt`, `ipAddress`, `policyVersion` como prova demonstrável (Art. 8º, §2º)
- `audit_logs` — imutável (sem `updatedAt`/`deletedAt`); referencia `patientToken`, nunca `patientId`; campo `legalBasis` por operação
- `data_requests` — fila de direitos do titular (Art. 18); tipos: access, correction, deletion, portability, anonymization, revoke_consent, automated_decision_review; campo `deadlineAt` para SLA
- `incidents` — notificação de incidentes (Art. 48 + Resolução CD/ANPD nº 15/2024); campo `notifiedAnpdAt` rastreia prazo de 72h

**Schema `private`**

- `medical_records` — diagnóstico, prescrição, notas clínicas, CID; todos os campos sensíveis criptografados com `pgcrypto`; usa `sensitiveLegalBasisEnum` distinto do `legalBasisEnum` do Art. 7º (aqui aplica-se o Art. 11º)

### Enums principais

```typescript
roleEnum:                 'admin' | 'doctor' | 'receptionist' | 'patient'
legalBasisEnum:           'consent' | 'legal_obligation' | 'contract' | 'legitimate_interest' | 'vital_interest' | 'health_care' | 'research'
sensitiveLegalBasisEnum:  'health_care' | 'vital_interest' | 'research_anonymized' | 'legal_obligation'
consentPurposeEnum:       'medical_treatment' | 'data_sharing_partners' | 'research' | 'insurance' | 'marketing'
auditActionEnum:          'create' | 'read' | 'update' | 'delete' | 'export' | 'login' | 'logout' | 'consent_grant' | 'consent_revoke' | 'data_request' | 'incident_report'
dataRequestTypeEnum:      'access' | 'correction' | 'deletion' | 'portability' | 'anonymization' | 'revoke_consent' | 'information' | 'automated_decision_review'
```

---

## RBAC

Quatro roles com permissões progressivas:

| Role           | Como a conta é criada                                                        | Acesso após login                                                                  |
| -------------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `admin`        | Seed inicial ou outro admin                                                  | Tudo — incluindo `patient_tokens` e dashboard DPO                                  |
| `doctor`       | Criado pelo admin                                                            | `medical_records` dos seus próprios pacientes (RLS por `doctorId`), `appointments` |
| `receptionist` | Criado pelo admin                                                            | `patients` e `appointments` — sem acesso ao schema `private`                       |
| `patient`      | Criado pela recepcionista no cadastro, ou self-service para acesso ao painel | Apenas `/privacy` — os próprios dados via Art. 18                                  |

**Regras de criação de contas:**

- `admin`, `doctor` e `receptionist` nunca se auto-cadastram — contas criadas internamente via painel admin ou seed
- Um paciente pode existir em `patients` sem ter conta em `users` — o cadastro clínico não exige acesso ao sistema
- A conta `patient` em `users` é criada apenas quando o titular solicita acesso ao painel do titular (`/privacy`), vinculando-se ao registro existente via `userId` em `patients`
- O endpoint de cadastro público (`POST /auth/register`) cria exclusivamente role `patient` — qualquer outro role via esse endpoint deve ser bloqueado pelo middleware

O payload JWT carrega `{ sub: userId, role, iat, exp }`. O middleware de autorização valida role antes de qualquer operação sobre dados pessoais e registra a tentativa em `audit_logs`.

---

## Convenção de comentários LGPD no código

Todo bloco de código que implementa um requisito da LGPD deve ter um comentário na linha anterior no formato:

```typescript
// LGPD: Art. 6º, VII — segurança — proteção contra acesso não autorizado
// LGPD: Art. 8º, §2º — ônus da prova do consentimento recai sobre o controlador
```

---

## Frontend

### Views e propósito LGPD

| Rota            | Role(s)              | Propósito LGPD                                                                                                                               |
| --------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `/login`        | todos                | Autenticação — registra tentativa em `audit_logs` independente do resultado (Art. 6º, X)                                                     |
| `/patients/new` | receptionist         | Cadastro em duas etapas: (1) dados pessoais, (2) consentimento por finalidade — nenhum dado é enviado sem o consentimento completo (Art. 8º) |
| `/patients/:id` | doctor, receptionist | Visualização do paciente — cada acesso gera entrada em `audit_logs` com `patientToken` (Art. 6º, VII)                                        |
| `/appointments` | doctor, receptionist | Agendamento — exibe apenas o que o RLS do backend autoriza, sem filtragem adicional no frontend                                              |
| `/privacy`      | patient              | Painel do titular — todos os direitos do Art. 18: visualizar, editar, exportar, revogar consentimentos, abrir solicitações                   |
| `/admin`        | admin                | Dashboard do DPO: `audit_logs`, fila de `data_requests` com SLA, lista de `incidents` com alerta de prazo 72h                                |

### Convenções obrigatórias

**Formulários:** todo formulário que coleta dados pessoais usa `react-hook-form` com `zodResolver`. O schema Zod deve ser o mesmo gerado pelo `drizzle-zod` no backend — nunca duplique a definição. Importe do pacote compartilhado ou reexporte do backend.

**Consentimento:** o fluxo de cadastro de paciente exibe cada finalidade do `consentPurposeEnum` como item separado com descrição em linguagem simples. Nenhum checkbox pode vir pré-marcado. A UI deve permitir aceitar finalidades individualmente (Art. 8º — consentimento específico e inequívoco).

**Instância axios:** toda comunicação com o backend passa pela instância centralizada em `src/lib/api.ts`, configurada com `withCredentials: true` para envio automático do cookie httpOnly. Nunca use `fetch` diretamente fora desta instância.

**AuthContext:** armazena apenas `{ userId, role, name }` — nunca o token JWT em memória. O token vive exclusivamente no cookie httpOnly gerenciado pelo browser. O contexto é populado via endpoint `GET /auth/me` na inicialização da aplicação.

**Proteção de rotas:** componente `<ProtectedRoute roles={[...]} />` verifica o `role` do `AuthContext` antes de renderizar. Redireciona para `/login` se não autenticado, para `/unauthorized` se sem permissão. Cada redirecionamento por falta de permissão gera log no backend.

**Dados sensíveis:** nunca armazene dados de `medical_records` em estado global ou cache local. Dados do schema `private` são buscados sob demanda e descartados ao desmontar o componente.

### Estrutura de diretórios frontend

Organize livremente, respeitando três arquivos estratégicos obrigatórios:

- `src/lib/api.ts` — instância axios centralizada com `withCredentials: true`
- `src/contexts/AuthContext.tsx` — contexto de autenticação com `{ userId, role, name }`
- `src/contexts/ConsentContext.tsx` — estado do fluxo de consentimento em andamento

---

## Fases de desenvolvimento

Cada fase entrega o sistema em estado funcional e testável. Para iniciar uma fase, informe: "implemente a Fase N".

### Fase 1 — Fundação e controle de acesso `[x]`

Cobre: Módulo 3 (Segurança da Informação) e fundamentos do Módulo 1.

Entregas: Docker Compose com PostgreSQL 16 + Node.js + React; criação dos dois schemas; migrations com Drizzle Kit; tabelas `users` e `audit_logs`; autenticação JWT com `jose`; middleware RBAC; políticas RLS no PostgreSQL por role; seed com usuários de cada role para testes.

### Fase 2 — Cadastro de pacientes e consentimento `[x]`

Cobre: Módulo 1 (Fundamentos da LGPD) e Módulo 4 (Privacidade by Design).

Entregas: tabelas `patients`, `patient_tokens` e `consents`; fluxo de cadastro com consentimento por finalidade; validação Zod gerada via `drizzle-zod` (princípio da necessidade — Art. 6º, III); formulário React com shadcn; registro automático em `audit_logs` em toda operação sobre `patients`.

### Fase 3 — Agendamento e ciclo de vida dos dados `[x]`

Cobre: Módulo 2 (Ciclo de Vida dos Dados).

Entregas: tabelas `appointments` e `medical_records`; fluxo de agendamento no frontend; políticas de retenção com `retentionExpiresAt`; job de limpeza automática (soft delete → hard delete por base legal); distinção explícita entre soft delete e eliminação real (Art. 5º, XIV); view materializada de estatísticas anonimizadas sem identificadores (Art. 5º, XI); pseudonimização operacional via `patient_tokens` nos logs; configuração do `@fastify/swagger` + `@scalar/fastify-api-reference` em `/reference` — todos os endpoints documentados com schemas Zod como fonte de verdade do OpenAPI spec.

### Fase 4 — Segurança avançada e incidentes `[x]`

Cobre: Módulo 3 (aprofundamento) e Módulo 5 (Documentação e Compliance — parte técnica).

> **Antes de implementar:** execute `/seed-phase4` (commands/seed-phase4.md) para popular o banco com dados de teste que cobrem os cenários de criptografia, retenção vencida e consentimento revogado necessários para validar esta fase.

Entregas: criptografia em repouso com `pgcrypto` nos campos sensíveis de `medical_records` e CPF de `patients`; variáveis de ambiente via `.env` sem nenhum segredo hardcoded; tabela `incidents` com endpoint de notificação; alerta automático quando `notifiedAnpdAt` se aproxima do prazo de 72h (Resolução CD/ANPD nº 15/2024); geração de DPIA como documento estruturado pelo sistema.

### Fase 5 — Painel do titular e dashboard de conformidade `[ ]` ← FASE ATIVA

Cobre: Módulo 5 (Documentação e Compliance) e Módulo 6 (Responsabilidade do Profissional de TI).

Entregas: tabela `data_requests`; painel do titular com todos os direitos do Art. 18 (visualizar, corrigir, exportar em JSON/CSV, revogar consentimentos, solicitar exclusão, questionar decisões automatizadas); dashboard do DPO com fila de solicitações e SLA; ROPA (registro de atividades de tratamento) gerado automaticamente a partir dos `audit_logs`; relatório de conformidade exportável como evidência auditável.

---

## Estrutura de diretórios esperada

```plaintext
medagenda/                      # raiz do monorepo
├── pnpm-workspace.yaml         # declara packages: [backend, frontend]
├── package.json                # scripts globais (dev, build, lint)
├── CLAUDE.md
├── .claude/
├── docker-compose.yml
├── backend/
│   ├── package.json
│   └── src/
│       ├── db/
│       │   ├── schema/        # um arquivo por tabela, exporta tudo via index.ts
│       │   └── migrations/    # geradas pelo drizzle-kit
│       ├── modules/           # um módulo por domínio (auth, patients, appointments, etc.)
│       │   └── [module]/
│       │       ├── plugin.ts  # Fastify plugin — registra rotas com schemas Zod
│       │       ├── service.ts
│       │       └── schema.ts  # schemas Zod via drizzle-zod + tipos de resposta
│       ├── middleware/        # auth.ts, rbac.ts, audit.ts
│       └── lib/               # jwt.ts, pgcrypto.ts, tokens.ts
└── frontend/
    ├── package.json
    └── src/                   # gerado pelo template Vite react-ts
```

---

## Restrições

Nunca armazene segredos no código-fonte. Todo campo que contenha dado pessoal direto deve ter um comentário `// LGPD: dado pessoal — Art. 5º, I` ou `// LGPD: dado sensível — Art. 5º, II`. Não implemente funcionalidades além do escopo da fase ativa sem instrução explícita.
