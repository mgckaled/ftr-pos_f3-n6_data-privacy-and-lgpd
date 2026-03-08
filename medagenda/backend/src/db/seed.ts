import 'dotenv/config'
import bcrypt from 'bcryptjs'
import { randomUUID } from 'node:crypto'
import { db, pool } from './index.js'
import { users } from './schema/index.js'

// LGPD: Art. 6º, VII — senhas de seed hasheadas com bcrypt (rounds: 12)
// Nunca armazenar senhas em texto claro, mesmo em ambiente de desenvolvimento
const SALT_ROUNDS = 12

const seedUsers = [
  { name: 'Admin MedAgenda', email: 'admin@medagenda.dev',   password: 'Admin@123',   role: 'admin'         as const },
  { name: 'Dr. João Silva',  email: 'doctor@medagenda.dev',  password: 'Doctor@123',  role: 'doctor'        as const },
  { name: 'Ana Recepcionista',email: 'recep@medagenda.dev',  password: 'Recep@123',   role: 'receptionist'  as const },
  { name: 'Maria Paciente',  email: 'patient@medagenda.dev', password: 'Patient@123', role: 'patient'       as const },
]

// ── Fase 1: usuários base ───────────────────────────────────────────────────

async function seedBaseUsers() {
  console.log('\n── Usuários base ──────────────────────────────────────────')
  for (const u of seedUsers) {
    const passwordHash = await bcrypt.hash(u.password, SALT_ROUNDS)
    await db
      .insert(users)
      .values({ name: u.name, email: u.email, passwordHash, role: u.role })
      .onConflictDoNothing({ target: users.email })
    console.log(`  ${u.role.padEnd(12)} ${u.email}`)
  }
}

// ── Fase 4: dados de teste completos ────────────────────────────────────────
// Todos os cenários exigidos pelo seed-phase4.md:
//   - 3 pacientes com CPF criptografado (pgcrypto)
//   - consents em estados variados (granted / revoked)
//   - 6 appointments com status e datas distintos
//   - 3 medical records com campos sensíveis criptografados
//   - paciente 3 com retentionExpiresAt vencido (cenário de anonimização)

async function seedPhase4() {
  const KEY = process.env.PGCRYPTO_KEY
  if (!KEY) {
    console.error('PGCRYPTO_KEY não configurada — seed Fase 4 ignorado')
    return
  }

  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    // RLS: contexto admin para todas as inserções da sessão
    // LGPD: Art. 6º, VII — seed opera com privilégio de admin, sem expor dados ao exterior
    const adminRow = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'admin@medagenda.dev' LIMIT 1`,
    )
    const doctorRow = await client.query<{ id: string }>(
      `SELECT id FROM users WHERE email = 'doctor@medagenda.dev' LIMIT 1`,
    )

    const adminId  = adminRow.rows[0]?.id
    const doctorId = doctorRow.rows[0]?.id

    if (!adminId || !doctorId) {
      throw new Error('Usuários base não encontrados — execute db:seed primeiro')
    }

    await client.query(`SELECT set_config('app.current_user_id', $1, true)`, [adminId])
    await client.query(`SELECT set_config('app.current_role', 'admin', true)`)

    console.log('\n── Pacientes (CPF criptografado via pgcrypto) ─────────────')

    // Helpers de datas
    const future20y = new Date(Date.now() + 20 * 365 * 24 * 60 * 60 * 1000)
    const past1d    = new Date(Date.now() - 1  * 24 * 60 * 60 * 1000)
    const past5y    = new Date(Date.now() - 5  * 365 * 24 * 60 * 60 * 1000)

    // ── Pacientes ──────────────────────────────────────────────────────────
    // Idempotente: insere apenas se não existe registro com o mesmo nome
    // LGPD: Art. 6º, VII — CPF criptografado em repouso via pgp_sym_encrypt (Fase 4)

    const p1 = await client.query<{ id: string }>(
      `INSERT INTO patients (name, email, phone, birth_date, cpf, legal_basis, retention_expires_at, created_at, updated_at)
       SELECT 'Carlos Andrade', 'carlos.andrade@example.com', '(11) 91234-5678', '1978-04-12',
              encode(pgp_sym_encrypt('529.982.247-25', $1), 'base64'),
              'consent', $2, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Carlos Andrade')
       RETURNING id`,
      [KEY, future20y],
    )

    const p2 = await client.query<{ id: string }>(
      `INSERT INTO patients (name, email, phone, birth_date, cpf, legal_basis, retention_expires_at, created_at, updated_at)
       SELECT 'Fernanda Lima', 'fernanda.lima@example.com', '(21) 98765-4321', '1990-09-23',
              encode(pgp_sym_encrypt('111.444.777-35', $1), 'base64'),
              'consent', $2, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Fernanda Lima')
       RETURNING id`,
      [KEY, future20y],
    )

    // Paciente 3: retentionExpiresAt vencido → cenário de anonimização pelo job de retenção
    const p3 = await client.query<{ id: string }>(
      `INSERT INTO patients (name, email, phone, birth_date, cpf, legal_basis, retention_expires_at, created_at, updated_at)
       SELECT 'Roberto Souza', 'roberto.souza@example.com', '(31) 97654-3210', '1965-12-01',
              encode(pgp_sym_encrypt('371.274.628-60', $1), 'base64'),
              'consent', $2, now(), now()
       WHERE NOT EXISTS (SELECT 1 FROM patients WHERE name = 'Roberto Souza')
       RETURNING id`,
      [KEY, past1d],  // retentionExpiresAt vencido — job deve anonimizar (não deletar)
    )

    const patientId1 = p1.rows[0]?.id
    const patientId2 = p2.rows[0]?.id
    const patientId3 = p3.rows[0]?.id

    // Busca IDs caso já existam (re-seed idempotente)
    const fetchId = async (name: string): Promise<string> => {
      const r = await client.query<{ id: string }>(
        `SELECT id FROM patients WHERE name = $1 LIMIT 1`, [name],
      )
      return r.rows[0].id
    }

    const pid1 = patientId1 ?? await fetchId('Carlos Andrade')
    const pid2 = patientId2 ?? await fetchId('Fernanda Lima')
    const pid3 = patientId3 ?? await fetchId('Roberto Souza')

    console.log(`  Carlos Andrade  → ${pid1}`)
    console.log(`  Fernanda Lima   → ${pid2}`)
    console.log(`  Roberto Souza   → ${pid3} (retentionExpiresAt vencido)`)

    // ── Patient tokens (pseudonimização) ────────────────────────────────────
    // LGPD: Art. 12 — token substitui patientId nos audit_logs
    console.log('\n── Patient tokens ─────────────────────────────────────────')

    for (const [pid, label] of [[pid1, 'Carlos'], [pid2, 'Fernanda'], [pid3, 'Roberto']] as const) {
      const token = randomUUID()
      await client.query(
        `INSERT INTO patient_tokens (patient_id, token, created_at)
         SELECT $1, $2, now()
         WHERE NOT EXISTS (SELECT 1 FROM patient_tokens WHERE patient_id = $1)`,
        [pid, token],
      )
      console.log(`  ${label.padEnd(10)} token inserido`)
    }

    // ── Consents ────────────────────────────────────────────────────────────
    // LGPD: Art. 8º — consentimento por finalidade específica (nunca genérico)
    // Estados variados: granted, revoked, negado
    console.log('\n── Consents (estados variados) ────────────────────────────')

    type ConsentRow = { patientId: string; purpose: string; granted: boolean; revokedAt?: Date | null }

    const consentData: ConsentRow[] = [
      // Paciente 1 (Carlos): medical_treatment ✓, data_sharing ✓, research ✗, insurance ✓, marketing ✗
      { patientId: pid1, purpose: 'medical_treatment',    granted: true  },
      { patientId: pid1, purpose: 'data_sharing_partners',granted: true  },
      { patientId: pid1, purpose: 'research',             granted: false },
      { patientId: pid1, purpose: 'insurance',            granted: true  },
      { patientId: pid1, purpose: 'marketing',            granted: false },
      // Paciente 2 (Fernanda): medical_treatment ✓, data_sharing revogado, research ✗, insurance ✗, marketing ✗
      { patientId: pid2, purpose: 'medical_treatment',    granted: true  },
      { patientId: pid2, purpose: 'data_sharing_partners',granted: false, revokedAt: new Date() },
      { patientId: pid2, purpose: 'research',             granted: false },
      { patientId: pid2, purpose: 'insurance',            granted: false },
      { patientId: pid2, purpose: 'marketing',            granted: false },
      // Paciente 3 (Roberto): medical_treatment ✓, resto negado
      { patientId: pid3, purpose: 'medical_treatment',    granted: true  },
      { patientId: pid3, purpose: 'data_sharing_partners',granted: false },
      { patientId: pid3, purpose: 'research',             granted: false },
      { patientId: pid3, purpose: 'insurance',            granted: false },
      { patientId: pid3, purpose: 'marketing',            granted: false },
    ]

    let consentCount = 0
    for (const c of consentData) {
      await client.query(
        `INSERT INTO consents (patient_id, purpose, granted, ip_address, policy_version, revoked_at, granted_at)
         SELECT $1, $2, $3, '127.0.0.1', '1.0', $4, now()
         WHERE NOT EXISTS (
           SELECT 1 FROM consents WHERE patient_id = $1 AND purpose = $2
         )`,
        [c.patientId, c.purpose, c.granted, c.revokedAt ?? null],
      )
      consentCount++
    }
    console.log(`  ${consentCount} consents inseridos (idempotente)`)

    // ── Appointments ────────────────────────────────────────────────────────
    // LGPD: Art. 6º, I — retenção de 20 anos (CFM nº 1.821/2007)
    // Cenários variados: completed, scheduled, cancelled, no_show, vencido + deletado
    console.log('\n── Appointments (6 cenários) ──────────────────────────────')

    const apptData = [
      // #1 — Carlos, completed, 30 dias atrás, retenção futura
      { patientId: pid1, status: 'completed', scheduledAt: new Date(Date.now() - 30 * 86400000), retentionExpiresAt: future20y, deletedAt: null },
      // #2 — Carlos, completed, 15 dias atrás, retenção futura
      { patientId: pid1, status: 'completed', scheduledAt: new Date(Date.now() - 15 * 86400000), retentionExpiresAt: future20y, deletedAt: null },
      // #3 — Fernanda, scheduled, daqui 7 dias, retenção futura
      { patientId: pid2, status: 'scheduled', scheduledAt: new Date(Date.now() + 7  * 86400000), retentionExpiresAt: future20y, deletedAt: null },
      // #4 — Fernanda, cancelled, 5 dias atrás, retenção futura
      { patientId: pid2, status: 'cancelled', scheduledAt: new Date(Date.now() - 5  * 86400000), retentionExpiresAt: future20y, deletedAt: null },
      // #5 — Roberto, completed, 60 dias atrás, retentionExpiresAt VENCIDO + deletedAt → hard delete pelo job
      { patientId: pid3, status: 'completed', scheduledAt: new Date(Date.now() - 60 * 86400000), retentionExpiresAt: past1d, deletedAt: past1d },
      // #6 — Roberto, no_show, 90 dias atrás, retentionExpiresAt VENCIDO, sem deletedAt → anonimização
      { patientId: pid3, status: 'no_show',   scheduledAt: new Date(Date.now() - 90 * 86400000), retentionExpiresAt: past1d, deletedAt: null },
    ]

    const apptIds: string[] = []
    for (const [i, a] of apptData.entries()) {
      const r = await client.query<{ id: string }>(
        `INSERT INTO appointments (patient_id, doctor_id, scheduled_at, status, retention_expires_at, deleted_at, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, now(), now())
         RETURNING id`,
        [a.patientId, doctorId, a.scheduledAt, a.status, a.retentionExpiresAt, a.deletedAt],
      )
      apptIds.push(r.rows[0].id)
      const label = `#${i+1} ${a.status.padEnd(10)} paciente ${i < 2 ? 'Carlos' : i < 4 ? 'Fernanda' : 'Roberto'}`
      const extra = a.retentionExpiresAt < new Date() ? ' [retenção VENCIDA]' : ''
      const delExtra = a.deletedAt ? ' [deletedAt preenchido]' : ''
      console.log(`  ${label}${extra}${delExtra}`)
    }

    // ── Medical records (com campos sensíveis criptografados) ───────────────
    // LGPD: Art. 11 — dados sensíveis de saúde; criptografados via pgcrypto (Fase 4)
    // Appointments 1, 2 e 5 (índices 0, 1, 4 no array)
    console.log('\n── Medical records (criptografados via pgcrypto) ──────────')

    const mrData = [
      {
        appointmentIdx: 0, // #1 — Carlos
        patientId: pid1,
        diagnosis:      'Hipertensão arterial sistêmica leve',
        prescription:   'Losartana 50mg — 1 comprimido ao dia em jejum',
        clinicalNotes:  'Paciente relata cefaleia ocasional. PA: 145/90 mmHg. Recomendado controle de sódio e atividade física regular.',
        icdCode:        'I10',
        retentionExpiresAt: future20y,
      },
      {
        appointmentIdx: 1, // #2 — Carlos
        patientId: pid1,
        diagnosis:      'Diabetes mellitus tipo 2 — diagnóstico inicial',
        prescription:   'Metformina 500mg — 1 comprimido com o almoço e jantar',
        clinicalNotes:  'Glicemia em jejum: 142 mg/dL. HbA1c: 7.2%. Orientado sobre dieta e monitoramento domiciliar.',
        icdCode:        'E11',
        retentionExpiresAt: future20y,
      },
      {
        appointmentIdx: 4, // #5 — Roberto (retentionExpiresAt vencido — hard delete pelo job)
        patientId: pid3,
        diagnosis:      'Infecção do trato urinário',
        prescription:   'Nitrofurantoína 100mg — 2x ao dia por 7 dias',
        clinicalNotes:  'Urocultura positiva para E. coli. Paciente alérgica a sulfonamidas — registrado.',
        icdCode:        'N39.0',
        retentionExpiresAt: past1d, // vencido — deve ser hard deleted junto com o appointment
      },
    ]

    for (const mr of mrData) {
      const apptId = apptIds[mr.appointmentIdx]
      await client.query(
        // LGPD: Art. 6º, VII + Art. 46 — campos sensíveis criptografados com pgp_sym_encrypt
        `INSERT INTO private.medical_records
           (appointment_id, patient_id, doctor_id,
            diagnosis, prescription, clinical_notes,
            icd_code, sensitive_legal_basis, retention_expires_at, created_at, updated_at)
         SELECT $1, $2, $3,
           encode(pgp_sym_encrypt($4, $7), 'base64'),
           encode(pgp_sym_encrypt($5, $7), 'base64'),
           encode(pgp_sym_encrypt($6, $7), 'base64'),
           $8, 'health_care', $9, now(), now()
         WHERE NOT EXISTS (
           SELECT 1 FROM private.medical_records WHERE appointment_id = $1
         )`,
        [apptId, mr.patientId, doctorId,
         mr.diagnosis, mr.prescription, mr.clinicalNotes,
         KEY, mr.icdCode, mr.retentionExpiresAt],
      )
      const expired = mr.retentionExpiresAt < new Date() ? ' [retenção VENCIDA]' : ''
      console.log(`  appointment #${mr.appointmentIdx + 1} — ${mr.icdCode.padEnd(6)}${expired}`)
    }

    await client.query('COMMIT')

    // ── Resumo ─────────────────────────────────────────────────────────────
    console.log('\n── Resumo ─────────────────────────────────────────────────')

    const { rows: pSummary } = await client.query(`
      SELECT
        COUNT(*)                                              AS total,
        COUNT(*) FILTER (WHERE retention_expires_at < now()) AS vencidos
      FROM patients`)
    console.log(`  patients          total=${pSummary[0].total}  retentionVencida=${pSummary[0].vencidos}`)

    const { rows: cSummary } = await client.query(`
      SELECT
        COUNT(*)                                     AS total,
        COUNT(*) FILTER (WHERE revoked_at IS NOT NULL) AS revogados
      FROM consents`)
    console.log(`  consents          total=${cSummary[0].total}  revogados=${cSummary[0].revogados}`)

    const { rows: aSummary } = await client.query(`
      SELECT status, COUNT(*) AS n
      FROM appointments
      GROUP BY status
      ORDER BY status`)
    const aStr = aSummary.map((r: { status: string; n: string }) => `${r.status}=${r.n}`).join('  ')
    console.log(`  appointments      ${aStr}`)

    const { rows: mrSummary } = await client.query(`
      SELECT COUNT(*) AS total FROM private.medical_records`)
    console.log(`  medical_records   total=${mrSummary[0].total}`)

    const { rows: ptSummary } = await client.query(`
      SELECT COUNT(*) AS total FROM patient_tokens`)
    console.log(`  patient_tokens    total=${ptSummary[0].total}`)

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// ── Entry point ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('╔══════════════════════════════════════════════════╗')
  console.log('║  MedAgenda — Seed (Fase 1 + Fase 4)             ║')
  console.log('╚══════════════════════════════════════════════════╝')

  await seedBaseUsers()
  await seedPhase4()

  console.log('\n✅ Seed concluído.\n')
  await pool.end()
}

seed().catch((err) => {
  console.error('Erro no seed:', err)
  process.exit(1)
})
