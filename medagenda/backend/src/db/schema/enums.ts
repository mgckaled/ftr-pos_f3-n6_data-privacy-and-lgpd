import { pgEnum } from 'drizzle-orm/pg-core'

// LGPD: Art. 5º, I — categorias de agentes definem nível de acesso a dados pessoais
export const roleEnum = pgEnum('role', [
  'admin',
  'doctor',
  'receptionist',
  'patient',
])

// LGPD: Art. 7º — bases legais para tratamento de dados pessoais (rol taxativo)
export const legalBasisEnum = pgEnum('legal_basis', [
  'consent',
  'legal_obligation',
  'contract',
  'legitimate_interest',
  'vital_interest',
  'health_care',
  'research',
])

// LGPD: Art. 8º — finalidades específicas de consentimento (nunca consentimento genérico)
export const consentPurposeEnum = pgEnum('consent_purpose', [
  'medical_treatment',
  'data_sharing_partners',
  'research',
  'insurance',
  'marketing',
])

// LGPD: Art. 5º, XIV — estados explícitos do ciclo de vida do agendamento
export const appointmentStatusEnum = pgEnum('appointment_status', [
  'scheduled',
  'completed',
  'cancelled',
  'no_show',
])

// LGPD: Art. 11 — bases legais específicas para dados sensíveis de saúde (rol distinto do Art. 7º)
export const sensitiveLegalBasisEnum = pgEnum('sensitive_legal_basis', [
  'health_care',
  'vital_interest',
  'research_anonymized',
  'legal_obligation',
])

// LGPD: Art. 6º, X — responsabilização — categorias de ações auditáveis
export const auditActionEnum = pgEnum('audit_action', [
  'create',
  'read',
  'update',
  'delete',
  'export',
  'login',
  'logout',
  'consent_grant',
  'consent_revoke',
  'data_request',
  'incident_report',
])
