# MedAgenda — Frontend

Interface web do sistema de agendamento médico com conformidade à LGPD (Lei nº 13.709/2018).

## Stack

| Tecnologia | Versão / Detalhe |
| --- | --- |
| Build tool | Vite (`react-ts` template) |
| Framework | React + TypeScript |
| Estilização | Tailwind CSS v4 (`@tailwindcss/vite` — sem `tailwind.config.js`) |
| Componentes | shadcn/ui |
| Formulários | `react-hook-form` + `@hookform/resolvers/zod` |
| Validação | Zod (schemas importados de `@medagenda/shared`) |
| HTTP client | axios (instância centralizada com `withCredentials: true`) |
| Roteamento | React Router DOM |

## Estrutura de diretórios

```plaintext
src/
├── lib/
│   └── api.ts                    # instância axios centralizada
├── contexts/
│   ├── AuthContext.tsx            # { userId, role, name } — JWT nunca em memória
│   └── ConsentContext.tsx         # estado do fluxo de consentimento em andamento
├── components/
│   ├── ProtectedRoute.tsx         # guard de rota por role
│   └── ui/                        # componentes shadcn/ui
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       ├── badge.tsx
│       ├── checkbox.tsx
│       ├── separator.tsx
│       └── textarea.tsx
└── pages/
    ├── Login.tsx
    └── patients/
        ├── NewPatient.tsx         # cadastro em 2 passos com consentimento
        └── PatientDetail.tsx      # visualização do paciente
```

## Rotas

| Rota | Role(s) | Página | Status |
| --- | --- | --- | --- |
| `/login` | público | Login | Implementado |
| `/patients/new` | receptionist, admin | Cadastro de paciente | Implementado |
| `/patients/:id` | admin, doctor, receptionist | Detalhe do paciente | Implementado |
| `/appointments` | doctor, receptionist | Agendamentos | Placeholder |
| `/privacy` | patient | Painel do titular (Art. 18) | Placeholder |
| `/admin` | admin | Dashboard DPO | Placeholder |
| `/unauthorized` | — | Acesso negado | Placeholder |

## Autenticação

O JWT **nunca** é armazenado em `localStorage` ou em memória — vive exclusivamente no
cookie `httpOnly` gerenciado pelo browser.

Fluxo:

1. `POST /auth/login` → backend define cookie `httpOnly; SameSite=Strict`
2. `AuthContext` chama `GET /auth/me` na inicialização para popular `{ userId, role, name }`
3. Todas as requisições seguintes enviam o cookie automaticamente via `withCredentials: true`
4. `POST /auth/logout` → backend limpa o cookie; `AuthContext` zera o estado local

O `AuthContext` expõe apenas `{ userId, role, name }`. Dados adicionais do usuário
são buscados sob demanda e nunca ficam em cache global.

## Formulário de cadastro de paciente (`/patients/new`)

Implementa o fluxo de coleta de dados pessoais com consentimento em conformidade com
o Art. 8º da LGPD:

### Passo 1 — Dados pessoais

Coleta os campos obrigatórios (`name`, `cpf`, `birthDate`) e opcionais (`email`, `phone`).
O schema Zod é importado de `@medagenda/shared` — mesma definição usada pelo backend,
sem duplicação.

### Passo 2 — Consentimentos por finalidade

- Exibe cada uma das 5 finalidades do `consentPurposeEnum` com descrição em linguagem simples
- **Nenhum checkbox é pré-marcado** — Art. 8º exige consentimento livre e inequívoco
- Cada finalidade pode ser aceita ou recusada individualmente
- `policyVersion` é registrada em cada item como prova do consentimento (Art. 8º, §2º)
- O formulário só é submetido após o Passo 2 — nenhum dado trafega antes do consentimento

Finalidades disponíveis:

| Chave | Descrição exibida |
| --- | --- |
| `medical_treatment` | Tratamento médico e gestão de consultas |
| `data_sharing_partners` | Compartilhamento com parceiros de saúde |
| `research` | Pesquisa científica com dados anonimizados |
| `insurance` | Processamento por operadoras de seguro |
| `marketing` | Comunicações, novidades e promoções |

## Proteção de rotas

O componente `<ProtectedRoute roles={[...]} />` verifica o `role` do `AuthContext`:

- Não autenticado → redireciona para `/login`
- Autenticado sem permissão → redireciona para `/unauthorized`
- Cada redirecionamento por falta de permissão gera registro em `audit_logs` no backend

## Pacote compartilhado (`@medagenda/shared`)

Schemas Zod importados diretamente do pacote workspace — nunca redefinidos no frontend:

```typescript
import {
  insertPatientBodySchema,
  consentPurposes,
  consentPurposeDescriptions,
  type InsertPatientBody,
} from '@medagenda/shared'
```

## Instância axios

```typescript
// src/lib/api.ts
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
  withCredentials: true, // envia cookie httpOnly automaticamente
})

```

Toda comunicação com o backend passa por esta instância. O uso direto de `fetch` fora
dela é proibido pela convenção do projeto.

## Variáveis de ambiente

```env
VITE_API_URL=http://localhost:3000
```

## Scripts

```bash
pnpm dev      # servidor Vite em modo desenvolvimento
pnpm build    # compila para produção (dist/)
pnpm preview  # pré-visualiza o build de produção
```
