// LGPD: Art. 6º, VII — segurança — criptografia em repouso para dados pessoais e sensíveis
// LGPD: Art. 46 — medidas técnicas de proteção adequadas ao risco do tratamento
// Resolução CD/ANPD nº 15/2024 — medidas de segurança exigidas para dados de saúde
import { sql } from 'drizzle-orm'

// LGPD: Art. 6º, VII — chave de criptografia provida exclusivamente via variável de ambiente
// Nunca hardcoded no código-fonte — Art. 46, §1º exige medidas técnicas adequadas
function getEncryptionKey(): string {
  const key = process.env.PGCRYPTO_KEY
  if (!key) {
    throw new Error(
      'PGCRYPTO_KEY não configurada — variável de ambiente obrigatória para criptografia em repouso (LGPD Art. 46)',
    )
  }
  return key
}

/**
 * LGPD: Art. 6º, VII — segurança — fragmento SQL para criptografar campo de texto no INSERT.
 * Usa pgp_sym_encrypt (OpenPGP simétrico) com encode base64 para armazenamento em coluna text.
 *
 * Uso: `.insert().values({ campo: encryptField(valor) as unknown as string })`
 * O cast `as unknown as string` é necessário pois o Drizzle aceita SQL fragments em runtime
 * mas o tipo TypeScript da coluna é `string`.
 *
 * Mensagens OpenPGP em base64 sempre iniciam com "hQ" — use esse prefixo para detectar
 * se um campo já está criptografado (idempotência nos scripts de migração de dados).
 */
export function encryptField(value: string) {
  const key = getEncryptionKey()
  // LGPD: Art. 46 — encode base64 garante armazenamento seguro em coluna text sem perda de dados
  return sql`encode(pgp_sym_encrypt(${value}, ${key}), 'base64')`
}

/**
 * LGPD: Art. 6º, VII — retorna a chave para uso em queries SQL raw (client.query).
 * Exposta apenas para services internos que usam pgp_sym_decrypt em SELECT raw com RLS ativo.
 * Nunca incluída em respostas de API.
 */
export function getDecryptionKey(): string {
  return getEncryptionKey()
}
