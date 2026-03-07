import { sql } from 'drizzle-orm'
import { jsonb, pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { auditActionEnum } from './enums'
import { users } from './users'

// LGPD: Art. 6º, X — responsabilização e prestação de contas
// Imutável: sem updatedAt/deletedAt — registros de auditoria jamais podem ser alterados
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    // Quem realizou a ação (pode ser null para ações anônimas como login falho)
    userId: uuid('user_id').references(() => users.id),
    // LGPD: Art. 5º, XI — pseudonimização — nunca armazenar patientId diretamente
    patientToken: text('patient_token'),
    action: auditActionEnum('action').notNull(),
    resource: text('resource').notNull(),
    resourceId: text('resource_id'),
    // LGPD: Art. 7º — base legal da operação deve ser registrada
    legalBasis: text('legal_basis'),
    // LGPD: Art. 8º, §2º — prova da operação para demonstração de conformidade
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    metadata: jsonb('metadata'),
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
