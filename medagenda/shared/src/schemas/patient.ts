import { z } from 'zod'

// LGPD: Art. 7º — bases legais para tratamento de dados pessoais (Art. 7º, I–X)
export const legalBases = [
  'consent',
  'legal_obligation',
  'contract',
  'legitimate_interest',
  'vital_interest',
  'health_care',
  'research',
] as const

export type LegalBasis = (typeof legalBases)[number]

// LGPD: Art. 8º — consentimento por finalidade específica (nunca genérico)
export const consentPurposes = [
  'medical_treatment',
  'data_sharing_partners',
  'research',
  'insurance',
  'marketing',
] as const

export type ConsentPurpose = (typeof consentPurposes)[number]

// Descrições em linguagem simples — Art. 8º exige clareza para o titular
export const consentPurposeDescriptions: Record<ConsentPurpose, string> = {
  medical_treatment: 'Tratamento médico e gestão de consultas',
  data_sharing_partners: 'Compartilhamento com parceiros de saúde',
  research: 'Pesquisa científica com dados anonimizados',
  insurance: 'Processamento por operadoras de seguro',
  marketing: 'Comunicações, novidades e promoções',
}

const consentItemSchema = z.object({
  purpose: z.enum(consentPurposes),
  granted: z.boolean(),
  // LGPD: Art. 8º, §2º — versão da política aceita é prova do consentimento
  policyVersion: z.string().min(1),
})

export type ConsentItem = z.infer<typeof consentItemSchema>

// Schema principal — fonte única de verdade para backend e frontend
// LGPD: Art. 6º, III — necessidade — apenas campos indispensáveis ao tratamento
export const insertPatientBodySchema = z.object({
  name: z.string().min(2, 'Nome deve ter no mínimo 2 caracteres'), // LGPD: dado pessoal — Art. 5º, I
  email: z.string().email('E-mail inválido').optional().or(z.literal('')), // LGPD: dado pessoal — Art. 5º, I
  phone: z.string().optional(), // LGPD: dado pessoal — Art. 5º, I
  birthDate: z.string().min(1, 'Data de nascimento obrigatória'), // LGPD: dado pessoal — Art. 5º, I
  cpf: z
    .string()
    .length(11, 'CPF deve ter 11 dígitos')
    .regex(/^\d+$/, 'CPF deve conter apenas dígitos'), // LGPD: dado pessoal — Art. 5º, I
  legalBasis: z.enum(legalBases).default('consent'),
  // LGPD: Art. 8º — todos os 5 purposes devem ser declarados explicitamente
  consents: z
    .array(consentItemSchema)
    .length(5, 'Todos os 5 consentimentos devem ser explicitamente declarados'),
})

export type InsertPatientBody = z.infer<typeof insertPatientBodySchema>
