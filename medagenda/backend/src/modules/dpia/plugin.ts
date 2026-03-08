// LGPD: Art. 38 — DPIA (Relatório de Impacto à Proteção de Dados Pessoais)
// A ANPD pode exigir o DPIA do controlador; este endpoint o gera como documento estruturado.
// Implementação didática conforme boas práticas ISO/IEC 29134 — não é certificação oficial.
import type { FastifyInstance } from 'fastify'
import type { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import { authenticate } from '../../middleware/auth.js'
import { requireRole } from '../../middleware/rbac.js'

const processingActivitySchema = z.object({
  activity: z.string(),
  legalBasis: z.string(),
  dataCategories: z.array(z.string()),
  dataSubjects: z.string(),
  retentionPolicy: z.string(),
  technicalSafeguards: z.array(z.string()),
  risks: z.array(z.string()),
  mitigations: z.array(z.string()),
})

const dpiaResponseSchema = z.object({
  documentTitle: z.string(),
  // LGPD: Art. 38 — documento datado para fins de evidência auditável
  generatedAt: z.string(),
  version: z.string(),
  legalReference: z.string(),
  controller: z.object({
    name: z.string(),
    cnpj: z.string(),
    contact: z.string(),
  }),
  dpo: z.object({
    role: z.string(),
    contact: z.string(),
    responsibilities: z.array(z.string()),
  }),
  scope: z.string(),
  processingActivities: z.array(processingActivitySchema),
  // LGPD: Art. 46 — medidas técnicas de segurança implementadas
  globalTechnicalMeasures: z.array(z.string()),
  globalOrganizationalMeasures: z.array(z.string()),
  legalReferences: z.array(z.string()),
  nextReviewAt: z.string(),
})

export async function dpiaPlugin(app: FastifyInstance) {
  const server = app.withTypeProvider<ZodTypeProvider>()

  // GET /dpia — gerar DPIA do sistema MedAgenda
  // LGPD: Art. 38 — DPIA estruturado conforme boas práticas ISO/IEC 29134 (implementação didática)
  server.get(
    '/',
    {
      preHandler: [authenticate, requireRole('admin')],
      schema: {
        tags: ['dpia'],
        summary: 'Gerar DPIA do sistema',
        description:
          'LGPD Art. 38 — Relatório de Impacto à Proteção de Dados Pessoais. ' +
          'Estrutura conforme boas práticas ISO/IEC 29134 (implementação didática — requer validação jurídica para uso oficial).',
        response: { 200: dpiaResponseSchema },
      },
    },
    async (_request, reply) => {
      // LGPD: Art. 38 — documento gerado dinamicamente com timestamp de evidência
      const now = new Date()
      const nextReview = new Date(now)
      nextReview.setFullYear(nextReview.getFullYear() + 1)

      const dpia = {
        documentTitle: 'DPIA — MedAgenda: Sistema de Agendamento Médico com Conformidade LGPD',
        generatedAt: now.toISOString(),
        version: '4.0.0',
        legalReference: 'Lei nº 13.709/2018 (LGPD), Art. 38 + Resolução CD/ANPD nº 15/2024',

        controller: {
          name: 'MedAgenda Serviços de Saúde',
          cnpj: '00.000.000/0001-00',
          contact: 'dpo@medagenda.dev',
        },

        dpo: {
          role: 'Encarregado de Proteção de Dados (DPO)',
          contact: 'dpo@medagenda.dev',
          responsibilities: [
            'Orientar controlador e operadores sobre LGPD (Art. 41, §2º, I)',
            'Receber comunicações dos titulares (Art. 41, §2º, II)',
            'Orientar funcionários sobre práticas de proteção (Art. 41, §2º, III)',
            'Executar demais atribuições determinadas pela ANPD (Art. 41, §2º, IV)',
          ],
        },

        scope:
          'Sistema de agendamento de consultas médicas com tratamento de dados pessoais (Art. 5º, I) ' +
          'e dados sensíveis de saúde (Art. 5º, II) de pacientes, médicos e recepcionistas.',

        processingActivities: [
          {
            activity: 'Autenticação e controle de acesso',
            legalBasis: 'Art. 7º, II — execução de contrato / Art. 6º, VII — segurança',
            dataCategories: ['e-mail', 'senha (hash bcrypt)', 'role do sistema'],
            dataSubjects: 'Todos os usuários do sistema (admin, doctor, receptionist, patient)',
            retentionPolicy: 'Enquanto a conta estiver ativa; eliminação após 30 dias do encerramento',
            technicalSafeguards: [
              'JWT HS256 com expiração de 1h (sem refresh tokens)',
              'httpOnly cookie — token nunca em localStorage',
              'RLS por role — políticas PostgreSQL isolam dados por papel',
              'Audit log de login/logout independente do resultado',
            ],
            risks: [
              'Acesso não autorizado por credencial comprometida',
              'Elevação de privilégio por manipulação de role no JWT',
            ],
            mitigations: [
              'Expiração curta de 1h minimiza janela de exposição',
              'Role validado no middleware antes de qualquer operação',
              'Falhas de autenticação registradas em audit_logs',
            ],
          },
          {
            activity: 'Cadastro e tratamento de dados de pacientes',
            legalBasis:
              'Art. 11, II, f — proteção da saúde / Art. 7º, III — consentimento específico por finalidade',
            dataCategories: [
              'nome',
              'CPF (criptografado em repouso — pgcrypto)',
              'e-mail',
              'telefone',
              'data de nascimento',
            ],
            dataSubjects: 'Pacientes (titulares dos dados)',
            retentionPolicy:
              '5 anos a partir do cadastro quando base legal é consentimento; ' +
              'eliminação ou anonimização após vencimento (Art. 5º, XI e XIV)',
            technicalSafeguards: [
              'CPF criptografado com pgp_sym_encrypt (OpenPGP simétrico)',
              'RLS: receptionist e admin gerenciam; doctor somente leitura',
              'pseudonimização via patient_tokens — audit_logs nunca expõem patientId',
              'CPF excluído de todas as respostas de API (princípio da necessidade)',
            ],
            risks: [
              'Exposição de CPF em caso de vazamento do banco de dados',
              'Acesso indevido por profissional sem vínculo com o paciente',
            ],
            mitigations: [
              'Criptografia em repouso torna CPF ilegível sem a chave PGCRYPTO_KEY',
              'RLS impede acesso cross-patient mesmo com SQL injection',
              'Consentimento por finalidade separado — nunca genérico (Art. 8º)',
            ],
          },
          {
            activity: 'Agendamento de consultas',
            legalBasis: 'Art. 7º, III — execução de contrato de prestação de serviço de saúde',
            dataCategories: [
              'vínculo paciente-médico',
              'data/hora da consulta',
              'status',
              'notas do agendamento',
            ],
            dataSubjects: 'Pacientes e médicos',
            retentionPolicy:
              '20 anos — obrigação legal CFM nº 1.821/2007; soft delete preserva dados até hard delete automático',
            technicalSafeguards: [
              'RLS: admin e receptionist gerenciam; doctor acessa apenas seus agendamentos',
              'Soft delete (deletedAt) garante retenção antes da eliminação definitiva',
              'Job diário de limpeza automatiza hard delete após vencimento da retenção',
            ],
            risks: ['Acesso de médico a agendamentos de outros médicos'],
            mitigations: [
              'RLS policy appointments_doctor_own restringe por doctorId na sessão',
              'Audit log em cada acesso ao detalhe do agendamento',
            ],
          },
          {
            activity: 'Tratamento de dados sensíveis de saúde (prontuários)',
            legalBasis: 'Art. 11, II, f — proteção da saúde; base legal distinta do Art. 7º',
            dataCategories: [
              'diagnóstico (criptografado)',
              'prescrição médica (criptografada)',
              'notas clínicas (criptografadas)',
              'código CID',
            ],
            dataSubjects: 'Pacientes',
            retentionPolicy:
              '20 anos — Resolução CFM nº 1.821/2007; hard delete automatizado após vencimento',
            technicalSafeguards: [
              'Schema PostgreSQL separado (private) — isolamento físico de dados sensíveis',
              'Criptografia em repouso: diagnosis, prescription, clinical_notes via pgcrypto',
              'RLS: médico acessa apenas seus próprios prontuários (doctorId)',
              'Admin com acesso de leitura apenas para auditoria',
              'Dados nunca em estado global no frontend — descartados ao desmontar componente',
            ],
            risks: [
              'Acesso de médico a prontuário de paciente de outro médico',
              'Vazamento de dados sensíveis em logs ou respostas de API',
            ],
            mitigations: [
              'RLS medical_records_doctor_own — filtragem no banco, não na aplicação',
              'Descriptografia apenas no service — dado nunca trafega cifrado para o cliente',
              'Audit log em toda criação e leitura de prontuário',
            ],
          },
          {
            activity: 'Registro de consentimento',
            legalBasis: 'Art. 8º, §2º — ônus da prova do consentimento recai sobre o controlador',
            dataCategories: [
              'finalidade consentida',
              'timestamp de consentimento/revogação',
              'IP de origem',
              'versão da política',
            ],
            dataSubjects: 'Pacientes',
            retentionPolicy: 'Enquanto houver vínculo ativo; 5 anos após encerramento',
            technicalSafeguards: [
              'Consentimento por finalidade específica — nunca genérico (Art. 8º)',
              'Nenhum checkbox pré-marcado no frontend',
              'IP e policyVersion armazenados como prova demonstrável',
              'Revogação possível a qualquer momento — tabela consents rastreia revokedAt',
            ],
            risks: ['Contestação judicial sobre validade do consentimento'],
            mitigations: [
              'Registro imutável com IP, timestamp e versão da política',
              'Audit log de consent_grant e consent_revoke',
            ],
          },
          {
            activity: 'Notificação de incidentes de segurança',
            legalBasis:
              'Art. 48 — obrigação legal de comunicar incidentes à ANPD e aos titulares afetados',
            dataCategories: [
              'descrição do incidente',
              'timestamp de detecção',
              'timestamp de notificação à ANPD',
              'recursos afetados',
              'estimativa de titulares afetados',
            ],
            dataSubjects: 'Não aplicável (dado operacional interno)',
            retentionPolicy: 'Indefinido — evidência de conformidade regulatória',
            technicalSafeguards: [
              'RLS incidents_admin_only — acesso exclusivo ao DPO/admin',
              'Campo notifiedAnpdAt como prova do cumprimento do prazo de 72h',
              'Status de alerta calculado em tempo real (urgent/overdue)',
              'Audit log de todo incident_report',
            ],
            risks: ['Descumprimento do prazo de 72h para notificação à ANPD'],
            mitigations: [
              'Campo anpdAlertStatus: "urgent" quando < 12h restantes',
              'Campo anpdAlertStatus: "overdue" quando prazo vencido',
              'Dashboard DPO exibe urgentCount para monitoramento contínuo',
            ],
          },
        ],

        globalTechnicalMeasures: [
          'Row Level Security (RLS) PostgreSQL — isolamento de dados por role e usuário',
          'JWT HS256 com expiração de 1h em httpOnly cookie — sem exposição no cliente',
          'pgcrypto (pgp_sym_encrypt) — criptografia em repouso para CPF e dados sensíveis de saúde',
          'Pseudonimização via patient_tokens — audit_logs nunca referenciam patientId diretamente',
          'Audit logs imutáveis (sem updatedAt/deletedAt) — rastreabilidade completa',
          'Dois schemas PostgreSQL (public / private) — isolamento físico de dados sensíveis',
          'Soft delete com retentionExpiresAt — eliminação definitiva apenas após prazo legal',
          'Job diário de limpeza automática — hard delete e anonimização por base legal',
        ],

        globalOrganizationalMeasures: [
          'RBAC com quatro roles (admin, doctor, receptionist, patient) — princípio do menor privilégio',
          'Comentários LGPD em todo bloco de código que implementa requisito legal',
          'Documentação OpenAPI como evidência de conformidade (GET /reference)',
          'DPIA gerado pelo sistema como documento auditável (este endpoint)',
          'Seed controlado — admin, doctor e receptionist nunca se auto-cadastram',
        ],

        legalReferences: [
          'Lei nº 13.709/2018 (LGPD) — Art. 5º, 6º, 7º, 8º, 11, 12, 38, 41, 46, 48',
          'Resolução CD/ANPD nº 15/2024 — prazo de 72h para notificação de incidentes',
          'Resolução CFM nº 1.821/2007 — retenção obrigatória de prontuários por 20 anos',
          'ABNT NBR ISO/IEC 29134 — boas práticas para DPIA (referência metodológica)',
        ],

        nextReviewAt: nextReview.toISOString(),
      }

      return reply.status(200).send(dpia)
    },
  )
}
