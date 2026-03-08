/**
 * LGPD: Art. 6º, VII + Art. 46 — script de migração de dados existentes para criptografia em repouso
 *
 * Problema: registros criados antes da Fase 4 têm CPF e campos de medical_records em texto puro.
 * Este script re-criptografa esses registros usando a PGCRYPTO_KEY do .env.
 *
 * Idempotência: ignora registros que já começam com "hQ" (prefixo fixo de mensagens OpenPGP em base64).
 *
 * Uso: pnpm --filter backend db:encrypt-existing
 */
import 'dotenv/config'
import pg from 'pg'

const { Pool } = pg

async function main () {
  const PGCRYPTO_KEY = process.env.PGCRYPTO_KEY
  if (!PGCRYPTO_KEY) {
    console.error('❌ PGCRYPTO_KEY não configurada no .env — abortando.')
    process.exit(1)
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })
  const client = await pool.connect()

  try {
    console.log('🔐 Iniciando migração de dados existentes para criptografia em repouso...')
    console.log('   LGPD: Art. 6º, VII — proteção de dados pessoais e sensíveis em repouso\n')

    await client.query('BEGIN')

    // ── 1. Pacientes: criptografar CPF ─────────────────────────────────────────
    // LGPD: Art. 6º, VII — CPF é dado pessoal direto (Art. 5º, I); deve ser protegido em repouso
    const patientResult = await client.query(
      `UPDATE patients
       SET cpf = encode(pgp_sym_encrypt(cpf, $1), 'base64'),
           updated_at = now()
       WHERE cpf NOT LIKE 'hQ%'`,
      // "hQ" é o prefixo fixo de mensagens OpenPGP em base64 — identifica dados já cifrados
      [PGCRYPTO_KEY],
    )
    console.log(`✅ patients.cpf          — ${patientResult.rowCount} registro(s) criptografado(s)`)

    // ── 2. Medical records: criptografar campos sensíveis ───────────────────────
    // LGPD: Art. 11 — dados sensíveis de saúde exigem proteção adicional (Art. 5º, II)
    // Condição: atualiza apenas registros onde diagnosis não está cifrado OU é nulo com outros campos
    const mrDiagnosisResult = await client.query(
      `UPDATE private.medical_records
       SET
         diagnosis = CASE
           WHEN diagnosis IS NOT NULL AND diagnosis NOT LIKE 'hQ%'
           THEN encode(pgp_sym_encrypt(diagnosis, $1), 'base64')
           ELSE diagnosis
         END,
         prescription = CASE
           WHEN prescription IS NOT NULL AND prescription NOT LIKE 'hQ%'
           THEN encode(pgp_sym_encrypt(prescription, $1), 'base64')
           ELSE prescription
         END,
         clinical_notes = CASE
           WHEN clinical_notes IS NOT NULL AND clinical_notes NOT LIKE 'hQ%'
           THEN encode(pgp_sym_encrypt(clinical_notes, $1), 'base64')
           ELSE clinical_notes
         END,
         updated_at = now()
       WHERE
         (diagnosis IS NOT NULL AND diagnosis NOT LIKE 'hQ%')
         OR (prescription IS NOT NULL AND prescription NOT LIKE 'hQ%')
         OR (clinical_notes IS NOT NULL AND clinical_notes NOT LIKE 'hQ%')`,
      [PGCRYPTO_KEY],
    )
    console.log(
      `✅ medical_records campos — ${mrDiagnosisResult.rowCount} prontuário(s) criptografado(s)`,
    )

    await client.query('COMMIT')

    console.log('\n✅ Migração concluída com sucesso.')
    console.log(
      '   Todos os dados pessoais e sensíveis existentes estão agora criptografados em repouso.',
    )
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('❌ Erro durante a migração — ROLLBACK executado:', err)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

main()
