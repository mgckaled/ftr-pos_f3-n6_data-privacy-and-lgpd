import { sql } from 'drizzle-orm'
import { pgPolicy, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { roleEnum } from './enums'

// LGPD: Art. 6º, VII — segurança — Row Level Security garante isolamento de dados por sessão
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(), // LGPD: dado pessoal — Art. 5º, I
    email: text('email').notNull().unique(), // LGPD: dado pessoal — Art. 5º, I
    // LGPD: Art. 6º, VII — segurança — senha armazenada apenas como hash bcrypt
    passwordHash: text('password_hash').notNull(),
    role: roleEnum('role').notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
    // LGPD: Art. 5º, XIV — eliminação: soft delete preserva integridade referencial
    deletedAt: timestamp('deleted_at'),
  },
  (t) => [
    // Admin vê todos os usuários
    pgPolicy('users_admin_all', {
      using: sql`current_setting('app.current_role', true) = 'admin'`,
    }),
    // LGPD: Art. 6º, III — necessidade — cada agente acessa apenas o próprio registro
    pgPolicy('users_self', {
      using: sql`
        current_setting('app.current_role', true) IN ('doctor', 'receptionist', 'patient')
        AND ${t.id}::text = current_setting('app.current_user_id', true)
      `,
    }),
  ],
)

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
