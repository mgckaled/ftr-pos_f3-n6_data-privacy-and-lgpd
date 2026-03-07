import { pgEnum } from 'drizzle-orm/pg-core'

// LGPD: Art. 5º, I — categorias de agentes definem nível de acesso a dados pessoais
export const roleEnum = pgEnum('role', [
  'admin',
  'doctor',
  'receptionist',
  'patient',
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
