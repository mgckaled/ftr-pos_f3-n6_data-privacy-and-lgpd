import { sql } from 'drizzle-orm'
import { jsonb, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { auditActionEnum, legalBasisEnum } from './enums'
import { users } from './users'

// LGPD: Art. 6º, X — responsabilização e prestação de contas
// Imutável: sem updatedAt/deletedAt — registros de auditoria jamais podem ser alterados
export const auditLogs = pgTable(
  'audit_logs',
  {
    // LGPD: Art. 6º, VII — segurança — identificador único sem exposição de dados pessoais
    id: uuid('id').primaryKey().defaultRandom(),
    // LGPD: Art. 6º, X — responsabilização — agente que realizou a ação (null = ação anônima)
    userId: uuid('user_id').references(() => users.id),
    // LGPD: Art. 5º, XI — pseudonimização — substitui patientId direto nos registros
    patientToken: text('patient_token'),
    // LGPD: Art. 6º, X — responsabilização — categoriza o tipo de operação auditada
    action: auditActionEnum('action').notNull(),
    // LGPD: Art. 6º, X — responsabilização — recurso sobre o qual a ação incidiu
    resource: text('resource').notNull(),
    // LGPD: Art. 6º, X — responsabilização — identificador do recurso afetado
    resourceId: text('resource_id'),
    // LGPD: Art. 7º — base legal da operação registrada como enum (não texto livre)
    legalBasis: legalBasisEnum('legal_basis'),
    // LGPD: Art. 8º, §2º — prova da operação: IP como evidência de acesso
    ipAddress: text('ip_address'),
    // LGPD: Art. 8º, §2º — prova de acesso para demonstração de conformidade
    userAgent: text('user_agent'),
    // LGPD: Art. 6º, X — responsabilização — dados contextuais da operação
    metadata: jsonb('metadata'),
    // LGPD: Art. 6º, X — responsabilização — timestamp imutável da operação
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => [
    // LGPD: Art. 6º, X — responsabilização — logs acessíveis ao controlador (admin/DPO)
    pgPolicy('audit_logs_admin_all', {
      using: sql`current_setting('app.current_role', true) = 'admin'`,
    }),
    // Demais roles veem apenas os próprios registros de auditoria
    pgPolicy('audit_logs_self', {
      using: sql`
        current_setting('app.current_role', true) IN ('doctor', 'receptionist', 'patient')
        AND ${t.userId}::text = current_setting('app.current_user_id', true)
      `,
    }),
  ],
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert
