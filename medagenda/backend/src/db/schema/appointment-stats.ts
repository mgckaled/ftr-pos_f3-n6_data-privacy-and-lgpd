import { isNull, sql } from 'drizzle-orm'
import { pgMaterializedView } from 'drizzle-orm/pg-core'
import { appointments } from './appointments'

// LGPD: Art. 5º, XI — estatísticas anonimizadas: nenhum identificador pessoal presente
// Agrega contagens por mês sem expor paciente, médico ou qualquer dado individual
export const appointmentStats = pgMaterializedView('appointment_stats').as((qb) =>
  qb
    .select({
      // LGPD: Art. 5º, XI — apenas agregados temporais; sem granularidade individual
      month: sql<string>`date_trunc('month', ${appointments.scheduledAt})`.as('month'),
      total: sql<number>`count(*)::int`.as('total'),
      completed: sql<number>`count(*) filter (where ${appointments.status} = 'completed')::int`.as('completed'),
      cancelled: sql<number>`count(*) filter (where ${appointments.status} = 'cancelled')::int`.as('cancelled'),
      noShow: sql<number>`count(*) filter (where ${appointments.status} = 'no_show')::int`.as('no_show'),
    })
    .from(appointments)
    .where(isNull(appointments.deletedAt))
    .groupBy(sql`date_trunc('month', ${appointments.scheduledAt})`),
)
