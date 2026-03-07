import 'dotenv/config'
import { drizzle } from 'drizzle-orm/node-postgres'
import pg from 'pg'
import * as schema from './schema/index.js'

const { Pool, types } = pg

// Preservar timestamps como string para evitar conversão de fuso horário
types.setTypeParser(1114, (val: string) => val)
types.setTypeParser(1184, (val: string) => val)

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL!,
})

export const db = drizzle(pool, { schema })

// LGPD: Art. 6º, VII — segurança — contexto de sessão define escopo de acesso via RLS
export async function withRLS<T>(
  userId: string,
  role: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    // SET LOCAL tem escopo de transação — garante isolamento entre requisições
    await client.query(`SET LOCAL app.current_user_id = '${userId}'`)
    await client.query(`SET LOCAL app.current_role = '${role}'`)
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}
